export interface Staff {
  staff_id: number;
  staff_name: string;
  staff_phone: string;
  staff_email: string;
  staff_address: string;
  staff_pic: string | null;
  Branch_Name: string;
  Branch_ID: number;
  role_name: string;
  role_id: number;
  status_text: string;
  status: number;
  salary: number;
  currencyName: string;
  currencyID: number;
}

export interface Branch {
  Branch_ID: number;
  Branch_Name: string;
}

export interface Role {
  role_id: number;
  role_name: string;
}

export interface Currency {
  currencyID: number;
  currencyName: string;
}

export interface CreateStaffRequest {
  staff_name: string;
  staff_phone: string;
  staff_email: string;
  staff_address: string;
  branch_id: number;
  role_id: number;
  salary: number;
  currency_id: number;
  status: number;
  password: string;
  photo?: File;
}

export interface UpdateStaffRequest {
  staff_id: number;
  staff_name: string;
  staff_phone: string;
  staff_email: string;
  staff_address: string;
  branch_id: number;
  role_id: number;
  salary: number;
  currency_id: number;
  status: number;
  password?: string;
  photo?: File;
}



