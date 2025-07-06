import AsyncStorage from '@react-native-async-storage/async-storage';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import * as Types from '../types';

// Configuration
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:6000/api' // Development
  : 'https://your-production-api.com/api'; // Production

class ApiService {
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        const token = await AsyncStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response.data,
      async (error) => {
        if (error.response?.status === 401) {
          await AsyncStorage.multiRemove(['token', 'user']);
          // You might want to redirect to login here
        }
        return Promise.reject(error);
      }
    );
  }

  private async request<T>(config: AxiosRequestConfig): Promise<T> {
    return this.axiosInstance.request(config);
  }

  // Auth API
  auth = {
    login: (credentials: Types.LoginRequest): Promise<Types.LoginResponse> =>
      this.request({ method: 'POST', url: '/auth/login', data: credentials }),

    logout: (): Promise<void> =>
      this.request({ method: 'POST', url: '/auth/logout' }),

    getCurrentUser: (): Promise<{ user: Types.User }> =>
      this.request({ method: 'GET', url: '/auth/me' }),

    refreshToken: (): Promise<{ token: string }> =>
      this.request({ method: 'POST', url: '/auth/refresh' }),

    forgotPassword: (email: string): Promise<{ message: string }> =>
      this.request({ method: 'POST', url: '/auth/forgot-password', data: { email } }),

    resetPassword: (token: string, password: string): Promise<{ message: string }> =>
      this.request({ method: 'POST', url: '/auth/reset-password', data: { token, password } }),
  };

  // Users API
  users = {
    getUsers: (page = 1, limit = 10, search = ''): Promise<Types.UsersResponse> =>
      this.request({ method: 'GET', url: '/users', params: { page, limit, search } }),

    getActiveUsers: (): Promise<Types.ActiveUsersResponse> =>
      this.request({ method: 'GET', url: '/users/active' }),

    createUser: (userData: Types.CreateUserRequest): Promise<{ user: Types.User }> =>
      this.request({ method: 'POST', url: '/users', data: userData }),

    getUser: (id: number): Promise<{ user: Types.User }> =>
      this.request({ method: 'GET', url: `/users/${id}` }),

    updateUser: (id: number, userData: Types.UpdateUserRequest): Promise<{ user: Types.User }> =>
      this.request({ method: 'PUT', url: `/users/${id}`, data: userData }),

    deleteUser: (id: number): Promise<{ message: string }> =>
      this.request({ method: 'DELETE', url: `/users/${id}` }),
  };

  // Projects API
  projects = {
    getProjects: (page = 1, limit = 10, search = '', status = ''): Promise<Types.ProjectsResponse> =>
      this.request({ method: 'GET', url: '/projects', params: { page, limit, search, status } }),

    createProject: (projectData: Types.CreateProjectRequest): Promise<{ project: Types.Project }> =>
      this.request({ method: 'POST', url: '/projects', data: projectData }),

    getProject: (id: number): Promise<{ project: Types.Project }> =>
      this.request({ method: 'GET', url: `/projects/${id}` }),

    updateProject: (id: number, projectData: Types.UpdateProjectRequest): Promise<{ project: Types.Project }> =>
      this.request({ method: 'PUT', url: `/projects/${id}`, data: projectData }),

    deleteProject: (id: number): Promise<{ message: string }> =>
      this.request({ method: 'DELETE', url: `/projects/${id}` }),

    getProjectFiles: (id: number): Promise<{ files: Types.ProjectFile[] }> =>
      this.request({ method: 'GET', url: `/projects/${id}/files` }),

    uploadFile: (projectId: number, file: FormData): Promise<{ file: Types.ProjectFile }> =>
      this.request({ 
        method: 'POST', 
        url: `/projects/${projectId}/upload`, 
        data: file,
        headers: { 'Content-Type': 'multipart/form-data' }
      }),
  };

  // Customers API
  customers = {
    getCustomers: (page = 1, limit = 10, search = ''): Promise<Types.CustomersResponse> =>
      this.request({ method: 'GET', url: '/customers', params: { page, limit, search } }),

    getSimpleCustomers: (): Promise<Types.SimpleCustomersResponse> =>
      this.request({ method: 'GET', url: '/customers/simple' }),

    createCustomer: (customerData: Types.CreateCustomerRequest): Promise<{ customer: Types.Customer }> =>
      this.request({ method: 'POST', url: '/customers', data: customerData }),

    getCustomer: (id: number): Promise<{ customer: Types.Customer }> =>
      this.request({ method: 'GET', url: `/customers/${id}` }),

    updateCustomer: (id: number, customerData: Types.UpdateCustomerRequest): Promise<{ customer: Types.Customer }> =>
      this.request({ method: 'PUT', url: `/customers/${id}`, data: customerData }),

    deleteCustomer: (id: number): Promise<{ message: string }> =>
      this.request({ method: 'DELETE', url: `/customers/${id}` }),

    createContact: (customerId: number, contactData: Types.CreateContactRequest): Promise<{ contact: Types.Contact }> =>
      this.request({ method: 'POST', url: `/customers/${customerId}/contacts`, data: contactData }),

    updateContact: (customerId: number, contactId: number, contactData: Types.UpdateContactRequest): Promise<{ contact: Types.Contact }> =>
      this.request({ method: 'PUT', url: `/customers/${customerId}/contacts/${contactId}`, data: contactData }),

    deleteContact: (customerId: number, contactId: number): Promise<{ message: string }> =>
      this.request({ method: 'DELETE', url: `/customers/${customerId}/contacts/${contactId}` }),
  };

  // Estimates API
  estimates = {
    getEstimates: (page = 1, limit = 10, search = '', status = ''): Promise<Types.EstimatesResponse> =>
      this.request({ method: 'GET', url: '/estimates', params: { page, limit, search, status } }),

    createEstimate: (estimateData: Types.CreateEstimateRequest): Promise<{ estimate: Types.Estimate }> =>
      this.request({ method: 'POST', url: '/estimates', data: estimateData }),

    getEstimate: (id: number): Promise<{ estimate: Types.Estimate }> =>
      this.request({ method: 'GET', url: `/estimates/${id}` }),

    updateEstimate: (id: number, estimateData: Types.UpdateEstimateRequest): Promise<{ estimate: Types.Estimate }> =>
      this.request({ method: 'PUT', url: `/estimates/${id}`, data: estimateData }),

    deleteEstimate: (id: number): Promise<{ message: string }> =>
      this.request({ method: 'DELETE', url: `/estimates/${id}` }),

    sendEstimateEmail: (id: number, emailData: { recipient_email: string; sender_name?: string }): Promise<{ message: string }> =>
      this.request({ method: 'POST', url: `/estimates/${id}/send-email`, data: emailData }),

    createProjectFromEstimate: (id: number, projectData: { project_name: string; project_description?: string }): Promise<{ project: Types.Project }> =>
      this.request({ method: 'POST', url: `/estimates/${id}/create-project`, data: projectData }),
  };

  // Invoices API
  invoices = {
    getInvoices: (page = 1, limit = 10, search = '', status = ''): Promise<Types.InvoicesResponse> =>
      this.request({ method: 'GET', url: '/invoices', params: { page, limit, search, status } }),

    createInvoice: (invoiceData: Types.CreateInvoiceRequest): Promise<{ invoice: Types.Invoice }> =>
      this.request({ method: 'POST', url: '/invoices', data: invoiceData }),

    createInvoiceFromEstimate: (estimateId: number, data: { title?: string; due_date?: string }): Promise<{ invoice: Types.Invoice }> =>
      this.request({ method: 'POST', url: `/invoices/from-estimate/${estimateId}`, data }),

    getInvoice: (id: number): Promise<{ invoice: Types.Invoice }> =>
      this.request({ method: 'GET', url: `/invoices/${id}` }),

    updateInvoice: (id: number, invoiceData: Types.UpdateInvoiceRequest): Promise<{ invoice: Types.Invoice }> =>
      this.request({ method: 'PUT', url: `/invoices/${id}`, data: invoiceData }),

    deleteInvoice: (id: number): Promise<{ message: string }> =>
      this.request({ method: 'DELETE', url: `/invoices/${id}` }),
  };

  // Payments API
  payments = {
    getPublicKey: (): Promise<{ publishable_key: string; stripe_available: boolean }> =>
      this.request({ method: 'GET', url: '/payments/public-key' }),

    createPaymentIntent: (data: Types.CreatePaymentIntentRequest): Promise<Types.PaymentIntent> =>
      this.request({ method: 'POST', url: '/payments/create-payment-intent', data }),

    createCheckoutSession: (data: Types.CreateCheckoutSessionRequest): Promise<Types.CheckoutSession> =>
      this.request({ method: 'POST', url: '/payments/create-checkout-session', data }),

    getPaymentStatus: (invoiceId: number): Promise<Types.PaymentStatus> =>
      this.request({ method: 'GET', url: `/payments/payment-status/${invoiceId}` }),
  };

  // Files API
  files = {
    getProjectFiles: (projectId: number): Promise<{ files: Types.ProjectFile[] }> =>
      this.request({ method: 'GET', url: `/projects/${projectId}/files` }),

    downloadFile: (fileId: number): Promise<Blob> =>
      this.request({ method: 'GET', url: `/files/${fileId}/download`, responseType: 'blob' }),

    uploadFile: (projectId: number, file: FormData): Promise<{ file: Types.ProjectFile }> =>
      this.request({ 
        method: 'POST', 
        url: `/projects/${projectId}/upload`, 
        data: file,
        headers: { 'Content-Type': 'multipart/form-data' }
      }),

    deleteFile: (fileId: number): Promise<{ message: string }> =>
      this.request({ method: 'DELETE', url: `/files/${fileId}` }),

    updateFile: (fileId: number, data: { is_public: boolean }): Promise<{ file: Types.ProjectFile }> =>
      this.request({ method: 'PUT', url: `/files/${fileId}`, data }),
  };

  // Todos API
  todos = {
    getTodoLists: (projectId: number): Promise<Types.TodoList[]> =>
      this.request({ method: 'GET', url: `/projects/${projectId}/todolists` }),

    createTodoList: (projectId: number, title: string): Promise<Types.TodoList> =>
      this.request({ method: 'POST', url: `/projects/${projectId}/todolists`, data: { title } }),

    updateTodoList: (listId: number, title: string): Promise<Types.TodoList> =>
      this.request({ method: 'PUT', url: `/todolists/${listId}`, data: { title } }),

    deleteTodoList: (listId: number): Promise<void> =>
      this.request({ method: 'DELETE', url: `/todolists/${listId}` }),

    createTodoItem: (listId: number, content: string, assignedTo?: number | null, dueDate?: string | null): Promise<Types.TodoItem> =>
      this.request({ 
        method: 'POST', 
        url: `/todolists/${listId}/items`, 
        data: { content, assigned_to: assignedTo, due_date: dueDate } 
      }),

    updateTodoItem: (itemId: number, data: Partial<Types.TodoItem>): Promise<Types.TodoItem> =>
      this.request({ method: 'PUT', url: `/todoitems/${itemId}`, data }),

    deleteTodoItem: (itemId: number): Promise<void> =>
      this.request({ method: 'DELETE', url: `/todoitems/${itemId}` }),
  };
}

export const apiService = new ApiService();

// Legacy exports for backward compatibility
export const authAPI = apiService.auth;
export const usersAPI = apiService.users;
export const projectsAPI = apiService.projects;
export const customersAPI = apiService.customers;
export const estimatesAPI = apiService.estimates;
export const invoicesAPI = apiService.invoices;
export const paymentsAPI = apiService.payments;
export const filesAPI = apiService.files;
export const todoAPI = apiService.todos; 