# Orders API

API GraphQL para gerenciamento de pedidos, construída com NestJS, TypeORM e PostgreSQL.

## Execução

### Pré-requisitos
- Docker e Docker Compose instalados

### Passos

```bash
# 1. Copie o arquivo de variáveis de ambiente
cp .env.example .env

# 2. Suba os containers
docker compose up --build -d

# 3. Acesse o GraphQL Playground
# http://localhost:4000/graphql
```

### Executar testes

```bash
npm install
npm test
```

---

## Exemplos de queries GraphQL

### Criar usuário
```graphql
mutation {
  createUser(input: { name: "Alice", email: "alice@example.com" }) {
    id
    name
    email
  }
}
```

### Criar produto
```graphql
mutation {
  createProduct(input: { name: "Widget", price: 29.99, stock: 100 }) {
    id
    name
    price
    stock
  }
}
```

### Emitir ordem de compra
```graphql
mutation {
  createOrder(input: {
    userId: "<user-id>",
    items: [{ productId: "<product-id>", quantity: 2 }]
  }) {
    id
    total
    items {
      quantity
      price
      product { name }
    }
  }
}
```

### Listar usuários com pedidos
```graphql
query {
  users {
    id
    name
    orders {
      id
      total
    }
  }
}
```

---

## Decisões técnicas

### GraphQL (code-first)
Abordagem code-first com `@nestjs/graphql` permite definir o schema diretamente nos decorators TypeScript, mantendo entidades e tipos GraphQL em sincronia sem duplicação.

### TypeORM + PostgreSQL
TypeORM integra nativamente com NestJS e oferece suporte a `QueryRunner` com transações explícitas e **pessimistic locking** (`SELECT ... FOR UPDATE`), essencial para garantir integridade do estoque sob concorrência.

### Integridade de estoque sob concorrência
O fluxo de criação de pedido usa:
1. `SELECT ... FOR UPDATE` em cada produto — bloqueia a linha no banco até o commit, impedindo que duas requisições simultâneas leiam o mesmo estoque e ambas decrementem.
2. Ordenação dos IDs dos produtos antes de adquirir os locks, evitando deadlocks quando dois pedidos disputam os mesmos produtos em ordens inversas.
3. Rollback automático em qualquer erro, garantindo atomicidade.

### Logs estruturados
Uso do `Logger` nativo do NestJS, que emite logs com contexto (nome do serviço), timestamp e nível de severidade.

---

## Trade-offs considerados

| Decisão | Alternativa | Motivo da escolha |
|---|---|---|
| TypeORM | Prisma | Suporte nativo a `SELECT FOR UPDATE` via `QueryRunner` |
| `synchronize: true` | Migrations | Agilidade no desenvolvimento; em produção usaria migrations |
| UUID como PK | Serial int | Evita enumeração e facilita sharding futuro |
| Testes unitários com mocks | Testes de integração | Velocidade e isolamento; regras críticas cobertas sem depender de DB |

---

## O que faria diferente com mais tempo

- Substituir `synchronize: true` por migrations TypeORM
- Adicionar autenticação (JWT)
- Implementar paginação nas queries de listagem
- Testes de integração com banco em container (`@testcontainers/postgresql`)
- GitHub Actions para CI (lint + testes a cada push)
- Rate limiting e helmet para segurança básica
