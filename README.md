# ToolMaster - Sistema de Gestão

Estrutura reorganizada com separação clara entre frontend e backend.

## 📁 Estrutura do Projeto

```
├── backend/           # API Node.js + Express
│   ├── server.js      # Servidor principal
│   ├── db.js          # Configuração do banco de dados
│   ├── package.json
│   ├── helpers/       # Funções auxiliares
│   ├── middleware/    # Middleware de autenticação, etc
│   └── routes/        # Rotas da API
│
└── frontend/          # React + TypeScript + Vite
    ├── src/
    │   ├── main.tsx
    │   ├── pages/     # Páginas da aplicação
    │   ├── components/# Componentes React
    │   ├── hooks/
    │   ├── lib/
    │   ├── utils/
    │   └── styles/
    ├── package.json
    └── vite.config.ts
```

## 🚀 Como Rodar

### Backend (Porta 3001)
```bash
cd backend
npm install
npm start
```

### Frontend (Porta 5173)
```bash
cd frontend
npm install
npm run dev
```

## 🔗 Conexão

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001/api
- **Token**: Stored em `localStorage`

## 📝 Notas

- As URLs da API no frontend estão configuradas para `http://localhost:3001/api`
- Authentication usa JWT armazenado em localStorage
- CORS está configurado no backend
