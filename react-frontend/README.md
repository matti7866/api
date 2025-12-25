# Selab Nadiry Travel & Tourism - React Application

A modern, production-ready React application for managing travel and tourism operations. This application replaces the legacy PHP frontend while maintaining the same UI/UX design.

## 🚀 Features

- ✅ **Modern Tech Stack**: React 18, TypeScript, Vite
- ✅ **Authentication**: JWT-based authentication with secure token management
- ✅ **State Management**: React Context API + React Query for server state
- ✅ **Routing**: React Router v6 with protected routes
- ✅ **Styling**: Tailwind CSS with custom Color Admin theme
- ✅ **API Integration**: Axios with interceptors for seamless API communication
- ✅ **Reusable Components**: DataTables, Modals, Forms, Buttons
- ✅ **Responsive Design**: Mobile-first approach
- ✅ **Type Safety**: Full TypeScript support

## 📋 Prerequisites

Before you begin, ensure you have:

- Node.js (v18 or higher)
- npm or yarn
- XAMPP with PHP 7.4+ and MySQL
- Composer (for PHP dependencies)

## 🛠️ Installation

### 1. Install Dependencies

```bash
cd react-frontend
npm install
```

### 2. Environment Configuration

Create `.env` file for development (already created):

```env
VITE_API_BASE_URL=http://localhost/snt/api
VITE_APP_NAME=Selab Nadiry Travel & Tourism
VITE_APP_VERSION=2.0.0
```

For production, update `.env.production` with your production API URL.

### 3. Backend Setup

Ensure your PHP backend is running:

```bash
# Start XAMPP Apache and MySQL
# Navigate to http://localhost/snt/api/auth/login.php to test
```

## 🚦 Running the Application

### Development Mode

```bash
npm run dev
```

The application will start at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

### Preview Production Build

```bash
npm run preview
```

## 📁 Project Structure

```
react-frontend/
├── public/                 # Static assets
├── src/
│   ├── assets/            # Images, fonts, etc.
│   ├── components/        # Reusable components
│   │   ├── common/       # Common components (Button, Modal, etc.)
│   │   ├── forms/        # Form components
│   │   └── tables/       # Table components
│   ├── context/          # React Context providers
│   │   └── AuthContext.tsx
│   ├── hooks/            # Custom React hooks
│   ├── layouts/          # Layout components
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   └── MainLayout.tsx
│   ├── pages/            # Page components
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── customers/
│   │   ├── residence/
│   │   ├── visa/
│   │   └── ...
│   ├── services/         # API services
│   │   ├── api.ts
│   │   └── authService.ts
│   ├── types/            # TypeScript types
│   │   └── index.ts
│   ├── utils/            # Utility functions
│   │   ├── config.ts
│   │   ├── storage.ts
│   │   └── queryClient.ts
│   ├── App.tsx           # Main App component
│   ├── main.tsx          # Entry point
│   └── index.css         # Global styles
├── .env.development      # Development environment variables
├── .env.production       # Production environment variables
├── tailwind.config.js    # Tailwind CSS configuration
├── tsconfig.json         # TypeScript configuration
├── vite.config.ts        # Vite configuration
└── package.json          # Dependencies
```

## 🔐 Authentication Flow

1. **Login**: User submits credentials → API validates → JWT token returned
2. **Token Storage**: Token stored in localStorage
3. **Protected Routes**: Token validated on protected route access
4. **API Requests**: Token automatically included in all API requests
5. **Auto Logout**: Invalid/expired tokens trigger automatic logout

### Login Credentials

Use your existing staff credentials from the database:
- Username: Your staff email or name
- Password: Your staff password

## 🎨 UI Components

### Button Component

```tsx
import Button from './components/common/Button';

<Button variant="primary" size="md" onClick={handleClick}>
  Click Me
</Button>
```

Variants: `primary`, `secondary`, `success`, `danger`, `warning`

### Modal Component

```tsx
import Modal from './components/common/Modal';

<Modal isOpen={isOpen} onClose={handleClose} title="Modal Title" size="lg">
  <p>Modal content</p>
</Modal>
```

### DataTable Component

```tsx
import DataTable from './components/tables/DataTable';

<DataTable
  columns={columns}
  data={data}
  searchable={true}
  onRowClick={handleRowClick}
/>
```

## 🔌 API Integration

### Creating a New API Service

```typescript
// src/services/customerService.ts
import { api } from './api';
import { Customer, ApiResponse } from '../types';

export const customerService = {
  async getAll(): Promise<ApiResponse<Customer[]>> {
    return api.get('/customers');
  },

  async getById(id: number): Promise<ApiResponse<Customer>> {
    return api.get(`/customers/${id}`);
  },

  async create(data: Partial<Customer>): Promise<ApiResponse<Customer>> {
    return api.post('/customers', data);
  },

  async update(id: number, data: Partial<Customer>): Promise<ApiResponse<Customer>> {
    return api.put(`/customers/${id}`, data);
  },

  async delete(id: number): Promise<ApiResponse<void>> {
    return api.delete(`/customers/${id}`);
  },
};
```

### Using React Query

```typescript
import { useQuery, useMutation } from '@tanstack/react-query';
import { customerService } from '../services/customerService';

function MyComponent() {
  // Fetch data
  const { data, isLoading, error } = useQuery({
    queryKey: ['customers'],
    queryFn: customerService.getAll,
  });

  // Mutate data
  const createMutation = useMutation({
    mutationFn: customerService.create,
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}
```

## 🗺️ Adding New Pages

1. **Create Page Component**:
```tsx
// src/pages/mymodule/MyPage.tsx
import React from 'react';

const MyPage: React.FC = () => {
  return (
    <div className="fade-in">
      <h1 className="text-3xl font-bold">My Page</h1>
    </div>
  );
};

export default MyPage;
```

2. **Add Route in App.tsx**:
```tsx
import MyPage from './pages/mymodule/MyPage';

// In the Routes section:
<Route path="mypage" element={<MyPage />} />
```

3. **Add to Sidebar** (if needed):
Edit `src/layouts/Sidebar.tsx` and add to menuItems array.

## 🎯 PHP API Endpoints

### Authentication Endpoints

- **POST** `/api/auth/login` - User login
- **GET** `/api/auth/verify` - Verify JWT token
- **GET** `/api/auth/me` - Get current user
- **POST** `/api/auth/logout` - User logout

### Creating New PHP API Endpoints

```php
<?php
// api/customers/index.php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

require_once __DIR__ . '/../../connection.php';
require_once __DIR__ . '/../auth/JWTHelper.php';

// Verify authentication
$userData = JWTHelper::verifyRequest();
if (!$userData) {
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Unauthorized'
    ], 401);
}

// Handle request
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->query("SELECT * FROM customer ORDER BY customer_id DESC");
    $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    JWTHelper::sendResponse([
        'success' => true,
        'data' => $customers
    ]);
}
?>
```

## 🔧 Configuration

### Tailwind CSS Theme

The application uses a custom color scheme matching the original design:

```javascript
// tailwind.config.js
theme: {
  extend: {
    colors: {
      primary: {
        red: '#dc2626',
        dark: '#991b1b',
      },
      secondary: {
        black: '#1a1a1a',
        dark: '#2d2d2d',
      },
    },
  },
}
```

### TypeScript Configuration

Full type safety is enabled. Add new types in `src/types/index.ts`.

## 📱 Responsive Design

The application is fully responsive with breakpoints:

- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

## 🚀 Deployment

### Option 1: Build and Deploy to Existing Server

```bash
npm run build
# Copy dist folder contents to your web server
cp -r dist/* /path/to/your/server/
```

### Option 2: Deploy with Netlify/Vercel

1. Connect your repository
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Add environment variables

### Option 3: Serve with Express

```bash
npm install -g serve
serve -s dist -l 3000
```

## 🔍 Troubleshooting

### CORS Issues

If you encounter CORS errors, ensure your PHP API has proper headers:

```php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
```

### API Connection Issues

1. Verify XAMPP is running
2. Check API_BASE_URL in `.env`
3. Test API endpoints directly in browser/Postman

### Build Issues

```bash
# Clear cache and rebuild
rm -rf node_modules
rm -rf dist
npm install
npm run build
```

## 📝 Migration Checklist

- [x] React app structure created
- [x] Authentication system implemented
- [x] Layout components (Header, Sidebar) built
- [x] Dashboard page created
- [x] Sample Customers page created
- [ ] Residence module migration
- [ ] Visa module migration
- [ ] Payments module migration
- [ ] Staff module migration
- [ ] Reports module migration
- [ ] Complete API integration
- [ ] Testing & QA
- [ ] Production deployment

## 🤝 Contributing

1. Create a new branch for your feature
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## 📄 License

© 2024 Selab Nadiry. All rights reserved.

## 👨‍💻 Developer

Developed by Mattiullah Nadiry

For questions or support, contact the development team.

---

**Version:** 2.0.0  
**Last Updated:** October 2024
