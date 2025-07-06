export interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'user';
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  token: string;
  user: User;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  role?: 'admin' | 'user';
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  role?: 'admin' | 'user';
  is_active?: boolean;
}

export interface ApiResponse<T = any> {
  message?: string;
  data?: T;
  error?: string;
  errors?: Array<{ msg: string; param: string }>;
}

export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalUsers: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface UsersResponse {
  users: User[];
  pagination: PaginationInfo;
}

export interface Project {
  id: number;
  name: string;
  description: string;
  status: 'started' | 'active' | 'done';
  customer_id?: number | null;
  customer_name?: string | null;
  created_by: number;
  created_by_username?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  status?: 'started' | 'active' | 'done';
  customer_id?: number | null;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  status?: 'started' | 'active' | 'done';
  customer_id?: number | null;
}

export interface ProjectPaginationInfo {
  currentPage: number;
  totalPages: number;
  totalProjects: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ProjectsResponse {
  projects: Project[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalProjects: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface ProjectFile {
  id: number;
  project_id: number;
  original_name: string;
  stored_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  is_public: boolean;
  uploaded_by: number;
  created_at: string;
}

export interface TodoItem {
  id: number;
  todo_list_id: number;
  content: string;
  is_completed: boolean;
  assigned_to?: number | null;
  assigned_username?: string | null;
  assigned_user_role?: 'admin' | 'user' | null;
  due_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TodoList {
  id: number;
  project_id: number;
  title: string;
  created_at: string;
  items: TodoItem[];
}

export interface ActiveUsersResponse {
  users: User[];
}

export interface Customer {
  id: number;
  name: string;
  description?: string;
  industry?: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  created_by?: number;
  created_by_username?: string;
  created_at: string;
  updated_at: string;
  contacts?: Contact[];
}

export interface Contact {
  id: number;
  customer_id: number;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  position?: string;
  department?: string;
  is_primary: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomerRequest {
  name: string;
  description?: string;
  industry?: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
}

export interface UpdateCustomerRequest {
  name?: string;
  description?: string;
  industry?: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
}

export interface CreateContactRequest {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  position?: string;
  department?: string;
  is_primary?: boolean;
  notes?: string;
}

export interface UpdateContactRequest {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  position?: string;
  department?: string;
  is_primary?: boolean;
  notes?: string;
}

export interface CustomersResponse {
  customers: Customer[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCustomers: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface SimpleCustomersResponse {
  customers: { id: number; name: string }[];
}

export interface EstimateItem {
  id?: number;
  estimate_id?: number;
  description: string;
  quantity: number;
  unit_price: number;
  total_price?: number;
  created_at?: string;
}

export interface Estimate {
  id: number;
  title: string;
  description?: string;
  customer_id?: number | null;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'expired';
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  valid_until?: string | null;
  notes?: string;
  created_by: number;
  created_by_username?: string;
  created_at: string;
  updated_at: string;
  items?: EstimateItem[];
}

export interface CreateEstimateRequest {
  title: string;
  description?: string;
  customer_id?: number | null;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  tax_rate?: number;
  valid_until?: string | null;
  notes?: string;
  items: EstimateItem[];
}

export interface UpdateEstimateRequest {
  title?: string;
  description?: string;
  status?: 'draft' | 'sent' | 'approved' | 'rejected' | 'expired';
  customer_id?: number | null;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  tax_rate?: number;
  valid_until?: string | null;
  notes?: string;
}

export interface EstimatesResponse {
  estimates: Estimate[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalEstimates: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface InvoiceItem {
  id?: number;
  invoice_id?: number;
  description: string;
  quantity: number;
  unit_price: number;
  total_price?: number;
  created_at?: string;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  title: string;
  description?: string;
  customer_id?: number | null;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  estimate_id?: number | null;
  project_id?: number | null;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  due_date?: string | null;
  paid_date?: string | null;
  payment_intent_id?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  stripe_session_id?: string | null;
  notes?: string;
  created_by: number;
  created_by_username?: string;
  estimate_title?: string;
  project_name?: string;
  created_at: string;
  updated_at: string;
  items?: InvoiceItem[];
}

export interface CreateInvoiceRequest {
  title: string;
  description?: string;
  customer_id?: number | null;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  estimate_id?: number | null;
  project_id?: number | null;
  tax_rate?: number;
  due_date?: string | null;
  notes?: string;
  items: InvoiceItem[];
}

export interface UpdateInvoiceRequest {
  title?: string;
  description?: string;
  status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  customer_id?: number | null;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  tax_rate?: number;
  due_date?: string | null;
  paid_date?: string | null;
  notes?: string;
}

export interface PaymentIntent {
  client_secret: string;
  payment_intent_id: string;
}

export interface CheckoutSession {
  session_id: string;
  url: string;
}

export interface PaymentStatus {
  invoice_status: string;
  payment_status?: string;
  payment_method?: string;
  payment_details?: {
    status: string;
    amount: number;
    currency: string;
    payment_method?: string;
  } | null;
}

export interface CreatePaymentIntentRequest {
  invoice_id: number;
}

export interface CreateCheckoutSessionRequest {
  invoice_id: number;
  success_url: string;
  cancel_url: string;
}

export interface InvoicesResponse {
  invoices: Invoice[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalInvoices: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
} 