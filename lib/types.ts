export type BookingStatus = 'pending' | 'confirmed' | 'cancelled'

export type ServiceCategory = 'courts' | 'tables' | 'trainings' | 'other'

export interface Service {
  id: string
  name: string
  description: string | null
  category: string
  duration_minutes: number
  price: number
  currency?: string
  is_active: boolean
  created_at: string
  updated_at?: string
}

export interface Resource {
  id: string
  service_id: string
  name: string
  kind: string
  capacity?: number
  sort_order: number
  is_active?: boolean
  created_at?: string
  updated_at?: string
}

export type SlotReason = 'closed' | 'booked' | 'not_generated'

export interface ResourceSlot {
  resource_id: string
  start_time: string
  end_time: string
  available: boolean
  reason?: SlotReason
}

export interface SlotsApiResponse {
  service: {
    id: string
    name: string
    category: ServiceCategory
    duration_minutes?: number
  }
  resources: Resource[]
  day: string
  granularity_minutes: number
  open_time: string
  close_time: string
  slots: ResourceSlot[]
}

export interface Availability {
  id: string
  service_id: string
  resource_id: string
  date: string
  start_time: string
  end_time: string
  is_available: boolean
  created_at: string
  updated_at?: string
}

export interface Booking {
  id: string
  service_id: string
  resource_id?: string | null
  date: string
  start_time: string
  end_time: string
  customer_name: string
  customer_email: string | null
  customer_phone: string | null
  note: string | null
  status: BookingStatus
  created_at: string
  updated_at: string
}

export interface TimeSlot {
  start_time: string
  end_time: string
  available: boolean
}

export interface AdminUser {
  email: string
  created_at: string
}

export interface BookingFormData {
  customer_name: string
  customer_email?: string
  customer_phone?: string
  note?: string
}
