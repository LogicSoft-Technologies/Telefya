export type AccountStatus = "active" | "suspended";

export type AdminRole =
  | "super_admin"
  | "admin"
  | "support"
  | "analyst"
  | "marketing";

export type AudienceFilters = {
  search?: string;
  country?: string;
  plan_code?: string;
  account_status?: AccountStatus;
  verified?: boolean | null;
  marketing_opt_in?: boolean | null;
  created_from?: string;
  created_to?: string;
  user_ids?: string[];
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
};

export type AdminUser = {
  user_id: string;
  first_name?: string | null;
  last_name?: string | null;
  email: string;
  phone_number?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  profile_image?: string | null;
  is_verified?: boolean | number;
  account_status?: AccountStatus;
  marketing_opt_in?: boolean | number;
  marketing_opt_in_at?: string | null;
  created_at?: string;
  updated_at?: string;
  plan_code?: string;
  subscription_status?: string;
  admin_role?: AdminRole | null;
  meeting_participant_limit_override?: number | null;
};

export type AdminUserDetails = {
  user: AdminUser;
  activity: {
    meetings: {
      total_meetings?: number;
      upcoming_meetings?: number;
      live_meetings?: number;
    };
    recordings: {
      total_recordings?: number;
      ready_recordings?: number;
    };
  };
};

export type AdminDashboard = {
  users: {
    total_users?: number;
    verified_users?: number;
    active_users?: number;
    suspended_users?: number;
    marketing_opted_in_users?: number;
  };
  meetings: {
    total_meetings?: number;
    upcoming_meetings?: number;
    live_meetings?: number;
    ended_meetings?: number;
  };
  recordings: {
    total_recordings?: number;
    ready_recordings?: number;
    active_recordings?: number;
  };
  subscriptions: {
    total_subscriptions?: number;
    paid_subscriptions?: number;
    free_subscriptions?: number;
  };
  campaigns: {
    total_campaigns?: number;
    draft_campaigns?: number;
    scheduled_campaigns?: number;
    sent_campaigns?: number;
  };
};

export type AudienceSegment = {
  id: number | string;
  name: string;
  description?: string | null;
  filters: AudienceFilters;
  created_by_user_id?: string;
  created_by_name?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AudiencePreview = {
  total: number;
  preview: Array<{
    user_id: string;
    first_name?: string | null;
    last_name?: string | null;
    email: string;
    country?: string | null;
    plan_code?: string;
  }>;
  filters: AudienceFilters;
  marketing_only: boolean;
};

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "failed"
  | "cancelled";

export type AdminCampaign = {
  id: number | string;
  name: string;
  subject: string;
  preheader?: string | null;
  status: CampaignStatus;
  scheduled_for?: string | null;
  started_at?: string | null;
  sent_at?: string | null;
  total_recipients?: number;
  sent_count?: number;
  failed_count?: number;
  created_at?: string;
  updated_at?: string;
  created_by_user_id?: string;
  created_by_name?: string | null;
};

export type AdminCampaignDetails = AdminCampaign & {
  html_content?: string | null;
  text_content?: string | null;
  audience_filter: AudienceFilters;
  recipient_counts: Array<{
    delivery_status: string;
    total: number;
  }>;
};

export type AdminMeeting = {
  id: number | string;
  meeting_url: string;
  des?: string | null;
  time_zone?: string | null;
  scheduled_for?: string | null;
  status: "upcoming" | "live" | "ended" | "cancelled";
  started_at?: string | null;
  ended_at?: string | null;
  created_at?: string;
  updated_at?: string;
  host_user_id?: string;
  host_first_name?: string | null;
  host_last_name?: string | null;
  host_email?: string | null;
  accepted_members?: number;
};

export type AdminRecording = {
  id: number | string;
  recording_id: string;
  room_id?: string | null;
  meeting_id?: number | string | null;
  host_user_id?: string | null;
  title?: string | null;
  status: string;
  file_name?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  duration_seconds?: number | null;
  started_at?: string | null;
  stopped_at?: string | null;
  expires_at?: string | null;
  created_at?: string;
  host_first_name?: string | null;
  host_last_name?: string | null;
  host_email?: string | null;
  meeting_description?: string | null;
  meeting_url?: string | null;
};

export type ReportRange = {
  from: string;
  to: string;
  days: number;
};

export type UsageDeviceModality = {
  device_type: string;
  unique_users: number;
  session_events: number;
};

export type DailyUsage = {
  date: string;
  active_users: number;
  meetings: number;
  participant_sessions: number;
  meeting_minutes: number;
};

export type UsageTopHost = {
  user_id: string;
  host_name?: string | null;
  host_email?: string | null;
  meetings_hosted: number;
  meeting_minutes: number;
  participants: number;
};

export type AdminUsageReport = {
  range: ReportRange;
  overview: {
    active_users: number;
    active_hosts: number;
    total_meetings: number;
    total_participant_sessions: number;
    total_meeting_minutes: number;
    average_session_minutes: number;
  };
  device_modalities: UsageDeviceModality[];
  daily_usage: DailyUsage[];
  top_hosts: UsageTopHost[];
};

export type DailyQuality = {
  date: string;
  samples: number;
  average_round_trip_time_ms: number;
  average_jitter_ms: number;
  average_packet_loss_percent: number;
  average_quality_score: number;
  unstable_samples: number;
};

export type QualityAffectedUser = {
  user_id?: string | null;
  user_name?: string | null;
  email?: string | null;
  samples: number;
  average_round_trip_time_ms: number;
  average_jitter_ms: number;
  average_packet_loss_percent: number;
  average_quality_score: number;
  unstable_samples: number;
  last_sample_at?: string | null;
};

export type ConnectionStateSummary = {
  connection_state: string;
  total: number;
};

export type AdminQualityReport = {
  range: ReportRange;
  telemetry_available: boolean;
  overview: {
    samples: number;
    measured_users: number;
    measured_rooms: number;
    average_round_trip_time_ms: number;
    average_jitter_ms: number;
    average_packet_loss_percent: number;
    average_quality_score: number;
    unstable_samples: number;
    affected_users: number;
  };
  daily_quality: DailyQuality[];
  affected_users: QualityAffectedUser[];
  connection_states: ConnectionStateSummary[];
};

export type ComplianceAttendanceRecord = {
  id: number | string;
  room_id: string;
  meeting_id?: number | string | null;
  meeting_title: string;
  user_id: string;
  attendee_name?: string | null;
  attendee_email?: string | null;
  host_email?: string | null;
  joined_at?: string | null;
  left_at?: string | null;
  duration_minutes?: number | null;
};

export type AdminComplianceReport = {
  range: ReportRange;
  overview: {
    meetings_with_attendance: number;
    attendance_records: number;
    unique_attendees: number;
    attended_minutes: number;
    average_attendance_minutes: number;
    total_recordings: number;
    ready_recordings: number;
    storage_bytes: number;
    recording_seconds: number;
  };
  attendance: ComplianceAttendanceRecord[];
  pagination: Pagination;
};

export type AdminAuditLog = {
  id: number | string;
  admin_user_id: string;
  admin_name?: string | null;
  admin_email?: string | null;
  admin_role?: AdminRole | null;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  metadata?: Record<string, unknown> | string | null;
  ip_address?: string | null;
  created_at?: string | null;
};

export type AdminSecurityReport = {
  range: ReportRange;
  overview: {
    admin_actions: number;
    active_administrators: number;
    account_status_changes: number;
    campaign_actions: number;
    suspended_accounts: number;
  };
  audit_log: AdminAuditLog[];
};

export type AdminReportingOverview = {
  range: ReportRange;
  usage: AdminUsageReport;
  quality: AdminQualityReport;
  compliance: AdminComplianceReport;
  security: AdminSecurityReport;
};