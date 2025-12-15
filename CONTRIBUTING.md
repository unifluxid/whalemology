# Contributing to Whalemology

Thank you for your interest in contributing! This document provides guidelines and best practices for development.

## 🎯 Development Workflow

### 1. Setting Up Your Environment

```bash
# Fork and clone the repository
git clone <your-fork-url>
cd whalemology

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
```

### 2. Creating a Branch

```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Or a bugfix branch
git checkout -b fix/bug-description
```

### 3. Making Changes

- Write clean, readable code
- Follow the existing code style
- Add comments for complex logic
- Update documentation as needed

### 4. Before Committing

Run the validation script to ensure code quality:

```bash
npm run validate
```

This runs:

- ESLint (linting)
- Prettier (formatting)
- TypeScript (type checking)

### 5. Committing Changes

```bash
git add .
git commit -m "type: description"
```

**Commit Message Format:**

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

**Pre-commit hooks** will automatically:

- Lint and fix your code
- Format your code with Prettier
- Prevent commits with errors

### 6. Pushing and Pull Requests

```bash
# Push your branch
git push origin feature/your-feature-name

# Create a Pull Request on GitHub
```

## 📝 Code Style Guidelines

### JavaScript/TypeScript

- Use **single quotes** for strings
- Add **semicolons** at the end of statements
- Use **2 spaces** for indentation
- Prefer **const** over **let**, avoid **var**
- Use **arrow functions** for callbacks
- Use **async/await** over promises when possible

### Import Order

Imports are automatically sorted by ESLint:

```javascript
// 1. React
import React from 'react';

// 2. Next.js
import Image from 'next/image';
import Link from 'next/link';

// 3. External libraries
import { format } from 'date-fns';

// 4. Internal modules (with @ alias)
import { Button } from '@/components/ui/button';

// 5. Relative imports
import { helper } from '../utils/helper';
```

### TypeScript Usage

- **New files**: Use `.ts` or `.tsx` extensions
- **Type annotations**: Add types for function parameters and return values
- **Interfaces**: Use for object shapes
- **Avoid `any`**: Use specific types or `unknown`

Example:

```typescript
interface User {
  id: string;
  name: string;
  email: string;
}

async function getUser(id: string): Promise<User> {
  // implementation
}
```

### React Components

- Use **functional components** with hooks
- Use **TypeScript** for new components
- Keep components **small and focused**
- Extract reusable logic into custom hooks

Example:

```typescript
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function Button({ label, onClick, disabled = false }: ButtonProps) {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}
```

## 🧪 Testing

[Add testing guidelines when tests are implemented]

## 🐛 Reporting Bugs

When reporting bugs, please include:

1. **Description**: Clear description of the issue
2. **Steps to Reproduce**: Detailed steps to reproduce the bug
3. **Expected Behavior**: What should happen
4. **Actual Behavior**: What actually happens
5. **Environment**: Browser, OS, Node version
6. **Screenshots**: If applicable

## 💡 Suggesting Features

When suggesting features:

1. **Use Case**: Describe the problem you're trying to solve
2. **Proposed Solution**: Your suggested approach
3. **Alternatives**: Other solutions you've considered
4. **Additional Context**: Any other relevant information

## 🔍 Code Review Process

All submissions require review. We use GitHub pull requests for this purpose:

1. Ensure all checks pass (linting, formatting, type-checking)
2. Update documentation if needed
3. Add tests if applicable
4. Request review from maintainers
5. Address review feedback
6. Once approved, your PR will be merged

## 📋 Pull Request Checklist

Before submitting a PR, ensure:

- [ ] Code follows the style guidelines
- [ ] All tests pass (when implemented)
- [ ] `npm run validate` passes without errors
- [ ] Documentation is updated
- [ ] Commit messages follow the format
- [ ] Branch is up to date with main

## 🙏 Thank You!

Your contributions make this project better. We appreciate your time and effort!
