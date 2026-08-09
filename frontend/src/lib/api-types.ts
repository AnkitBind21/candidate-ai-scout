// Types mirroring the existing FastAPI backend schemas.
// Optional fields are used where the backend may omit values.

export interface User {
  id: string;
  full_name: string;
  email: string;
  created_at?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type?: string;
  user: User;
}

export interface MessageResponse {
  message: string;
}

export interface Job {
  id: string;
  title: string;
  description?: string | null;
  department?: string | null;
  location?: string | null;
  employment_type?: string | null;
  min_experience?: number | null;
  max_experience?: number | null;
  required_skills?: string[] | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface JobListResponse {
  total: number;
  items: Job[];
}

export interface JobPayload {
  title: string;
  description?: string;
  department?: string;
  location?: string;
  employment_type?: string;
  min_experience?: number | null;
  max_experience?: number | null;
  required_skills?: string[];
}

export interface JobEntities {
  title?: string | null;
  required_skills?: string[] | null;
  preferred_skills?: string[] | null;
  responsibilities?: string[] | null;
  qualifications?: string[] | null;
  education?: string[] | string | null;
  location?: string | null;
  department?: string | null;
  employment_type?: string | null;
  min_experience?: number | null;
  max_experience?: number | null;
  [key: string]: unknown;
}

export interface ParsedJD {
  word_count?: number;
  is_structured?: boolean;
  detected_sections?: string[] | Record<string, unknown>;
  entities: JobEntities;
  warnings?: string[];
}

export interface Candidate {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  job_id: string;
  created_at?: string | null;
  resumes?: Resume[];
}

export interface CandidateListResponse {
  total: number;
  items: Candidate[];
}

export interface CandidatePayload {
  full_name: string;
  email?: string;
  phone?: string;
  job_id: string;
}

export interface Resume {
  id: string;
  candidate_id: string;
  original_filename: string;
  stored_filename?: string;
  file_type?: string | null;
  file_size?: number | null;
  created_at?: string | null;
}

export interface ParsedResumeData {
  text_preview?: string;
  detected_sections?: string[] | Record<string, unknown>;
  word_count?: number;
  is_scanned?: boolean;
  warnings?: string[];
}

export interface EducationEntry {
  institution: string;
  degree?: string | null;
  field_of_study?: string | null;
  start_year?: string | null;
  end_year?: string | null;
  gpa?: string | null;
  raw?: string;
}

export interface ExperienceEntry {
  company: string;
  title?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_current?: boolean;
  responsibilities?: string[];
  raw?: string;
}

export interface ProjectEntry {
  name: string;
  description?: string | null;
  technologies?: string[];
  url?: string | null;
  raw?: string;
}

export interface CertificationEntry {
  name: string;
  issuer?: string | null;
  date?: string | null;
  raw?: string;
}

export interface PublicationEntry {
  title: string;
  venue?: string | null;
  year?: string | null;
  authors?: string[];
  doi?: string | null;
  raw?: string;
}

export interface ExtractedEntities {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedin?: string | null;
  github?: string | null;
  skills?: string[] | null;
  education?: EducationEntry[] | null;
  experience?: ExperienceEntry[] | null;
  projects?: ProjectEntry[] | null;
  certifications?: CertificationEntry[] | null;
  publications?: PublicationEntry[] | null;
  extraction_warnings?: string[] | null;
  [key: string]: unknown;
}

export interface ResumeUploadResponse {
  message: string;
  resume: Resume;
  parsed?: ParsedResumeData | null;
  entities?: ExtractedEntities | null;
}

export interface MatchResult {
  id?: string;
  candidate_id?: string;
  job_id?: string;
  overall_score?: number | null;
  skill_score?: number | null;
  experience_score?: number | null;
  education_score?: number | null;
  recommendation?: string | null;
  matched_skills?: string[] | null;
  missing_skills?: string[] | null;
  extra_skills?: string[] | null;
  status?: string | null;
  notes?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}

export type Analysis = MatchResult;

/**
 * The actual response shape of POST /match (see app/api/matching.py):
 * the score/recommendation/skill fields are nested under `result`, not
 * top-level. Used only inside useMatchCandidate() to unwrap the response
 * before handing a flat MatchResult back to callers.
 */
export interface MatchResponse {
  candidate_id: string;
  job_id: string;
  result: MatchResult;
  warnings?: string[];
}

export interface Paginated<T> {
  total: number;
  items: T[];
}