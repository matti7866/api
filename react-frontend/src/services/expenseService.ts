import apiClient from './api';
import type {
  ExpenseType,
  Expense,
  ExpenseTotal,
  CreateExpenseRequest,
  ExpenseFilters
} from '../types/expense';

const expenseService = {
  async getExpenseTypes(): Promise<ExpenseType[]> {
    const response = await apiClient.post('/expense/expenses.php', {
      action: 'getExpenseTypes'
    });
    return response.data.success ? response.data.data : [];
  },

  async createExpense(data: CreateExpenseRequest): Promise<{ success: boolean; message: string }> {
    const formData = new FormData();
    formData.append('action', 'createExpense');
    formData.append('expense_type_id', String(data.expense_type_id));
    formData.append('expense_amount', String(data.expense_amount));
    formData.append('currency_id', String(data.currency_id));
    formData.append('account_id', String(data.account_id));
    formData.append('expense_remark', data.expense_remark);
    formData.append('amount_type', data.amount_type || 'fixed');
    
    if (data.expense_document) {
      formData.append('expense_document', data.expense_document);
    }

    const response = await apiClient.post('/expense/expenses.php', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    return {
      success: response.data.success,
      message: response.data.message || 'Expense created successfully'
    };
  },

  async getExpenses(filters?: ExpenseFilters): Promise<Expense[]> {
    const payload: any = {
      action: 'getExpenses'
    };
    
    if (filters) {
      if (filters.search_term) payload.search_term = filters.search_term;
      if (filters.from_date) payload.from_date = filters.from_date;
      if (filters.to_date) payload.to_date = filters.to_date;
      if (filters.employee_id) payload.employee_id = filters.employee_id;
    }

    const response = await apiClient.post('/expense/expenses.php', payload);
    return response.data.success ? response.data.data : [];
  },

  async getExpenseTotals(filters?: ExpenseFilters): Promise<ExpenseTotal[]> {
    const payload: any = {
      action: 'getExpenseTotals'
    };
    
    if (filters) {
      if (filters.search_term) payload.search_term = filters.search_term;
      if (filters.from_date) payload.from_date = filters.from_date;
      if (filters.to_date) payload.to_date = filters.to_date;
      if (filters.employee_id) payload.employee_id = filters.employee_id;
    }

    const response = await apiClient.post('/expense/expenses.php', payload);
    return response.data.success ? response.data.data : [];
  },

  async deleteExpense(expense_id: number): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post('/expense/expenses.php', {
      action: 'deleteExpense',
      expense_id
    });
    
    return {
      success: response.data.success,
      message: response.data.message || 'Expense deleted successfully'
    };
  },

  async getExpense(expense_id: number): Promise<Expense> {
    const response = await apiClient.post('/expense/expenses.php', {
      action: 'getExpense',
      expense_id
    });
    
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || 'Failed to fetch expense');
  },

  async updateExpense(data: {
    expense_id: number;
    expense_type_id: number;
    expense_amount: number;
    currency_id: number;
    account_id: number;
    expense_remark: string;
  }): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post('/expense/expenses.php', {
      action: 'updateExpense',
      ...data
    });
    
    return {
      success: response.data.success,
      message: response.data.message || 'Expense updated successfully'
    };
  },

  async getEmployees(): Promise<{ staff_id: number; staff_name: string }[]> {
    const response = await apiClient.post('/expense/expenses.php', {
      action: 'getEmployees'
    });
    return response.data.success ? response.data.data : [];
  }
};

// Expense Types Service
export const expenseTypeService = {
  async getExpenseTypes(): Promise<ExpenseType[]> {
    const response = await apiClient.post('/expense/expenseTypes.php', {
      action: 'getExpenseTypes'
    });
    return response.data.success ? response.data.data : [];
  },

  async createExpenseType(expense_type: string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post('/expense/expenseTypes.php', {
      action: 'createExpenseType',
      expense_type
    });
    
    return {
      success: response.data.success,
      message: response.data.message || 'Expense type created successfully'
    };
  },

  async updateExpenseType(expense_type_id: number, expense_type: string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post('/expense/expenseTypes.php', {
      action: 'updateExpenseType',
      expense_type_id,
      expense_type
    });
    
    return {
      success: response.data.success,
      message: response.data.message || 'Expense type updated successfully'
    };
  },

  async deleteExpenseType(expense_type_id: number): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post('/expense/expenseTypes.php', {
      action: 'deleteExpenseType',
      expense_type_id
    });
    
    return {
      success: response.data.success,
      message: response.data.message || 'Expense type deleted successfully'
    };
  },

  async getExpenseType(expense_type_id: number): Promise<ExpenseType> {
    const response = await apiClient.post('/expense/expenseTypes.php', {
      action: 'getExpenseType',
      expense_type_id
    });
    
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || 'Failed to fetch expense type');
  }
};

// Dashboard Service
export const expenseDashboardService = {
  async getDashboardStats(): Promise<{
    totalExpenseTypes: number;
    totalExpenses: number;
    thisMonthExpenses: number;
    pendingDocuments: number;
  }> {
    const response = await apiClient.post('/expense/dashboard.php', {
      action: 'getDashboardStats'
    });
    
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || 'Failed to fetch dashboard stats');
  },

  async getChartData(): Promise<{ labels: string[]; values: number[] }> {
    const response = await apiClient.post('/expense/dashboard.php', {
      action: 'getChartData'
    });
    
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || 'Failed to fetch chart data');
  },

  async getRecentActivities(): Promise<Array<{
    id: number;
    amount: string;
    currency: string;
    type: string;
    staff: string;
    time: string;
  }>> {
    const response = await apiClient.post('/expense/dashboard.php', {
      action: 'getRecentActivities'
    });
    
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || 'Failed to fetch recent activities');
  }
};

export default expenseService;

