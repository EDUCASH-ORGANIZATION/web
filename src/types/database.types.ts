export type UserRole = "student" | "client" | "admin"
export type MissionStatus = "open" | "in_progress" | "done" | "cancelled"
export type ApplicationStatus = "pending" | "accepted" | "rejected"
export type TransactionStatus = "pending" | "paid" | "failed" | "refunded"
export type MissionUrgency = "low" | "medium" | "high"
export type MissionType =
  | "Babysitting"
  | "Livraison"
  | "Aide administrative"
  | "Saisie"
  | "Community Management"
  | "Traduction"
  | "Cours particuliers"
  | "Autre"
export type City = "Cotonou" | "Porto-Novo" | "Abomey-Calavi"

export interface Profile {
  id: string
  user_id: string
  full_name: string | null
  city: City | null
  avatar_url: string | null
  bio: string | null
  phone: string | null
  role: UserRole
  is_verified: boolean
  rating: number
  missions_done: number
  fcm_token: string | null
  created_at: string
  updated_at: string
}

export interface StudentProfile {
  id: string
  user_id: string
  school: string | null
  level: string | null
  skills: string[]
  card_url: string | null
  availability: string | null
  created_at: string
  updated_at: string
}

export interface Mission {
  id: string
  client_id: string
  title: string
  description: string
  type: MissionType
  city: City
  budget: number
  urgency: MissionUrgency
  status: MissionStatus
  deadline: string | null
  selected_student_id: string | null
  created_at: string
  updated_at: string
}

export interface Application {
  id: string
  mission_id: string
  student_id: string
  message: string
  status: ApplicationStatus
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  mission_id: string
  sender_id: string
  receiver_id: string
  content: string
  read: boolean
  created_at: string
}

export interface Transaction {
  id: string
  mission_id: string
  client_id: string
  student_id: string
  amount_total: number
  commission: number
  amount_student: number
  fedapay_id: string | null
  status: TransactionStatus
  paid_at: string | null
  created_at: string
  updated_at: string
}

export interface Review {
  id: string
  mission_id: string
  reviewer_id: string
  reviewed_id: string
  rating: number
  comment: string | null
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, "id" | "created_at" | "updated_at" | "rating" | "missions_done">
        Update: Partial<Omit<Profile, "id" | "user_id" | "created_at" | "updated_at">>
      }
      student_profiles: {
        Row: StudentProfile
        Insert: Omit<StudentProfile, "id" | "created_at" | "updated_at">
        Update: Partial<Omit<StudentProfile, "id" | "user_id" | "created_at" | "updated_at">>
      }
      missions: {
        Row: Mission
        Insert: Omit<Mission, "id" | "created_at" | "updated_at" | "selected_student_id">
        Update: Partial<Omit<Mission, "id" | "client_id" | "created_at" | "updated_at">>
      }
      applications: {
        Row: Application
        Insert: Omit<Application, "id" | "created_at" | "updated_at">
        Update: Partial<Omit<Application, "id" | "mission_id" | "student_id" | "created_at" | "updated_at">>
      }
      messages: {
        Row: Message
        Insert: Omit<Message, "id" | "created_at" | "read">
        Update: Pick<Message, "read">
      }
      transactions: {
        Row: Transaction
        Insert: Omit<Transaction, "id" | "created_at" | "updated_at" | "paid_at">
        Update: Partial<Omit<Transaction, "id" | "mission_id" | "client_id" | "student_id" | "created_at" | "updated_at">>
      }
      reviews: {
        Row: Review
        Insert: Omit<Review, "id" | "created_at">
        Update: never
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      user_role: UserRole
      mission_status: MissionStatus
      application_status: ApplicationStatus
      transaction_status: TransactionStatus
      mission_urgency: MissionUrgency
      mission_type: MissionType
      city: City
    }
  }
}