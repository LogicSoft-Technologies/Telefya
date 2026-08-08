import { apiClient } from "@/lib/api/client";
import type {
  AccountStatus,
  AdminCampaign,
  AdminCampaignDetails,
  AdminDashboard,
  AdminMeeting,
  AdminRecording,
  AdminUser,
  AdminUserDetails,
  AudienceFilters,
  AudiencePreview,
  AudienceSegment,
  Pagination,
  AdminComplianceReport,
  AdminQualityReport,
  AdminReportingOverview,
  AdminSecurityReport,
  AdminUsageReport,
  CampaignStatus,
} from "@/types/admin";

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data: T;
  status: number;
};

function toQueryString(values: Record<string, unknown>) {
  const query = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    query.set(key, String(value));
  });

  const output = query.toString();

  return output ? `?${output}` : "";
}

export function getAdminDashboard() {
  return apiClient.get<ApiResponse<AdminDashboard>>("/admin/dashboard");
}

export function listAdminUsers(
  filters: AudienceFilters & {
    page?: number;
    limit?: number;
  } = {},
) {
  return apiClient.get<
    ApiResponse<{
      users: AdminUser[];
      pagination: Pagination;
      filters: AudienceFilters;
    }>
  >(`/admin/users${toQueryString(filters)}`);
}

export function getAdminUser(userId: string) {
  return apiClient.get<ApiResponse<AdminUserDetails>>(
    `/admin/users/${encodeURIComponent(userId)}`,
  );
}

export function updateAdminUserStatus(
  userId: string,
  accountStatus: AccountStatus,
) {
  return apiClient.patch<
    ApiResponse<{
      user_id: string;
      account_status: AccountStatus;
    }>
  >(`/admin/users/${encodeURIComponent(userId)}/account-status`, {
    account_status: accountStatus,
  });
}

export function listAudienceSegments() {
  return apiClient.get<ApiResponse<AudienceSegment[]>>("/admin/segments");
}

export function createAudienceSegment(payload: {
  name: string;
  description?: string;
  filters: AudienceFilters;
}) {
  return apiClient.post<ApiResponse<AudienceSegment>>(
    "/admin/segments",
    payload,
  );
}

export function previewAudience(payload: {
  filters: AudienceFilters;
  marketing_only?: boolean;
}) {
  return apiClient.post<ApiResponse<AudiencePreview>>(
    "/admin/audience/preview",
    payload,
  );
}

export function listCampaigns(page = 1, limit = 25) {
  return apiClient.get<
    ApiResponse<{
      campaigns: AdminCampaign[];
      pagination: Pagination;
    }>
  >(`/admin/campaigns?page=${page}&limit=${limit}`);
}

export function getCampaign(campaignId: number | string) {
  return apiClient.get<ApiResponse<AdminCampaignDetails>>(
    `/admin/campaigns/${encodeURIComponent(String(campaignId))}`,
  );
}

export function createCampaign(payload: {
  name: string;
  subject: string;
  preheader?: string;
  html_content: string;
  text_content?: string;
  filters: AudienceFilters;
  max_recipients?: number;
  status?: "draft" | "scheduled";
  scheduled_for?: string;
}) {
  return apiClient.post<
    ApiResponse<{
      id: number;
      name: string;
      status: string;
      total_recipients: number;
      scheduled_for?: string | null;
    }>
  >("/admin/campaigns", payload);
}

export function listAdminMeetings(
  filters: {
    page?: number;
    limit?: number;
    search?: string;
    status?: "upcoming" | "live" | "ended" | "cancelled";
  } = {},
) {
  return apiClient.get<
    ApiResponse<{
      meetings: AdminMeeting[];
      pagination: Pagination;
    }>
  >(`/admin/meetings${toQueryString(filters)}`);
}

export function listAdminRecordings(
  filters: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  } = {},
) {
  return apiClient.get<
    ApiResponse<{
      recordings: AdminRecording[];
      pagination: Pagination;
    }>
  >(`/admin/recordings${toQueryString(filters)}`);
}

export type ReportFilters = {
  from?: string;
  to?: string;
};

export function getAdminReportingOverview(
  filters: ReportFilters = {},
) {
  return apiClient.get<ApiResponse<AdminReportingOverview>>(
    `/admin/reports${toQueryString(filters)}`,
  );
}

export function getAdminUsageReport(
  filters: ReportFilters = {},
) {
  return apiClient.get<ApiResponse<AdminUsageReport>>(
    `/admin/reports/usage${toQueryString(filters)}`,
  );
}

export function getAdminQualityReport(
  filters: ReportFilters & { limit?: number } = {},
) {
  return apiClient.get<ApiResponse<AdminQualityReport>>(
    `/admin/reports/quality${toQueryString(filters)}`,
  );
}

export function getAdminComplianceReport(
  filters: ReportFilters & {
    page?: number;
    limit?: number;
  } = {},
) {
  return apiClient.get<ApiResponse<AdminComplianceReport>>(
    `/admin/reports/compliance${toQueryString(filters)}`,
  );
}

export function getAdminSecurityReport(
  filters: ReportFilters & { limit?: number } = {},
) {
  return apiClient.get<ApiResponse<AdminSecurityReport>>(
    `/admin/reports/security${toQueryString(filters)}`,
  );
}

export function queueCampaignDelivery(
  campaignId: number | string,
  payload: {
    delivery_mode: "now" | "scheduled";
    scheduled_for?: string;
  },
) {
  return apiClient.post<
    ApiResponse<{
      id: number | string;
      status: CampaignStatus;
      scheduled_for?: string | null;
    }>
  >(
    `/admin/campaigns/${encodeURIComponent(String(campaignId))}/delivery`,
    payload,
  );
}

export function cancelCampaignDelivery(campaignId: number | string) {
  return apiClient.post<
    ApiResponse<{
      id: number | string;
      status: "cancelled";
    }>
  >(
    `/admin/campaigns/${encodeURIComponent(String(campaignId))}/cancel`,
    {},
  );
}