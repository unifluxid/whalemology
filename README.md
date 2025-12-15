# Whalemology

A modern Next.js application for stock analysis and market insights.

## 🚀 Prerequisites

- **Node.js**: v20.19.5 (specified in `.nvmrc`)
- **Package Manager**: npm, yarn, pnpm, or bun

## 📦 Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd whalemology
   ```

2. **Install dependencies**

   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   # or
   bun install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` with your actual configuration values.

## 🛠️ Development

### Running the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Available Scripts

| Script                 | Description                                 |
| ---------------------- | ------------------------------------------- |
| `npm run dev`          | Start development server                    |
| `npm run build`        | Build for production                        |
| `npm start`            | Start production server                     |
| `npm run lint`         | Run ESLint to check code quality            |
| `npm run lint:fix`     | Auto-fix ESLint issues                      |
| `npm run format`       | Format code with Prettier                   |
| `npm run format:check` | Check code formatting without changes       |
| `npm run type-check`   | Run TypeScript type checking                |
| `npm run validate`     | Run all checks (lint + format + type-check) |

## 📁 Project Structure

```
whalemology/
├── app/                    # Next.js App Router pages and layouts
│   ├── api/               # API routes
│   ├── layout.js          # Root layout
│   └── page.js            # Home page
├── public/                # Static assets
├── styles/                # Global styles
├── docs/                  # Documentation
├── .husky/                # Git hooks
├── .eslintrc.json         # ESLint configuration
├── .prettierrc            # Prettier configuration
├── tsconfig.json          # TypeScript configuration
├── next.config.js         # Next.js configuration
└── package.json           # Dependencies and scripts
```

## 🎨 Code Quality

This project uses several tools to maintain code quality:

- **ESLint**: Linting with Next.js and TypeScript rules
- **Prettier**: Code formatting with Tailwind CSS class sorting
- **TypeScript**: Type safety (supports both `.js` and `.ts/.tsx` files)
- **Husky**: Git hooks for pre-commit checks
- **lint-staged**: Runs linting and formatting on staged files

### Pre-commit Hooks

Git hooks automatically run on every commit to:

- Lint and auto-fix code with ESLint
- Format code with Prettier
- Ensure code quality before committing

## 🔧 TypeScript

This project supports both JavaScript and TypeScript:

- **New files**: Use `.ts` or `.tsx` extensions for TypeScript
- **Existing files**: Can remain as `.js` or be gradually migrated
- **Type checking**: Run `npm run type-check` to verify types

## 🌍 Environment Variables

Environment variables are managed through `.env.local` (gitignored).

See `.env.example` for available configuration options.

### Public vs Private Variables

- `NEXT_PUBLIC_*`: Exposed to the browser
- Other variables: Server-side only

## 🐳 Docker

### Build and Run with Docker

```bash
# For npm/yarn/pnpm
docker build -t whalemology .

# For bun
docker build -f Dockerfile.bun -t whalemology .

# Run container
docker run -p 3000:3000 whalemology
```

## 🚢 Deployment

### Vercel (Recommended)

The easiest way to deploy is using [Vercel](https://vercel.com):

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

### Other Platforms

This app can be deployed to any platform that supports Next.js:

- AWS
- Google Cloud Run
- Azure
- Railway
- Render

See [Next.js deployment documentation](https://nextjs.org/docs/deployment) for details.

## 🤝 Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines and best practices.

## 📚 Documentation

- [API Documentation](./docs/API.md)
- [Architecture Overview](./docs/ARCHITECTURE.md)
- [Contributing Guidelines](./CONTRIBUTING.md)

## 📄 License

[Add your license here]

## 🔗 Links

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
