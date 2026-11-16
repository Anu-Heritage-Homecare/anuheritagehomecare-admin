/**
 * The Tasks back office, fetched live from the API and mapped into the shapes
 * the four task screens render. One read per screen: the list
 * (`GET /admin/tasks`), the detail (`GET /admin/tasks/:id`), the templates
 * screen (`GET /admin/tasks/templates`) and the settings screen
 * (`GET /admin/tasks/settings`). Every mutation invalidates the reads it
 * affects.
 *
 * This replaces the old in browser simulation. The backend returns one flat list
 * of STORED tasks with its labels already worked out, so the derived
 * (worked out) rows, the Source filter and the client side SLA timers are gone:
 * none of them had any backend truth behind them. Create and bulk assign send a
 * free text assignee label (the backend accepts `assigneeLabel`), since there is
 * no admin directory endpoint to resolve a name to an admin id yet.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Priority } from '@/types'

/* --------------------------- backend enums -------------------------------- */

export type BackendPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type BackendStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE'
export type BackendCategory =
  | 'CARE_ACTIVITY'
  | 'MEDICATION'
  | 'DOCUMENTATION'
  | 'SCHEDULING'
  | 'COMPLIANCE'
  | 'ADMINISTRATIVE'
  | 'OTHER'

export type TaskTab = 'ALL' | 'TODAY' | 'OVERDUE' | 'COMPLETED'

export const PRIORITY_VALUES: BackendPriority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW']
export const CATEGORY_VALUES: BackendCategory[] = [
  'CARE_ACTIVITY',
  'MEDICATION',
  'DOCUMENTATION',
  'SCHEDULING',
  'COMPLIANCE',
  'ADMINISTRATIVE',
  'OTHER',
]

/** Map a backend priority onto the UI `Priority` union for `PriorityBadge`. */
export function toUiPriority(value: string): Priority {
  switch (value) {
    case 'URGENT':
      return 'urgent'
    case 'HIGH':
      return 'high'
    case 'MEDIUM':
      return 'medium'
    case 'LOW':
      return 'low'
    default:
      return 'normal'
  }
}

/* --------------------------- backend responses ---------------------------- */

interface TaskRowDto {
  id: string
  title: string
  relatedVisitLabel: string | null
  assignee: string
  recipientName: string | null
  dueAt: string | null
  dueDateLabel: string | null
  priority: string
  priorityLabel: string
  status: string
  statusLabel: string
  category: string
  categoryLabel: string
}

interface TasksKpisDto {
  openTasks: number
  completedToday: number
  overdue: number
  highPriority: number
  dueToday: number
  completionRatePercent: number
}

interface TasksTabCountsDto {
  all: number
  today: number
  overdue: number
  completed: number
}

interface TasksScreenDto {
  kpis: TasksKpisDto
  tabCounts: TasksTabCountsDto
  page: number
  pageSize: number
  total: number
  totalPages: number
  rows: TaskRowDto[]
  generatedAt: string
}

interface TaskChecklistItemDto {
  id: string
  label: string
  done: boolean
}

interface TaskProgressDto {
  completed: number
  total: number
  percent: number
}

interface TaskCommentDto {
  id: string
  authorName: string
  body: string
  at: string
}

interface TaskActivityEntryDto {
  kind: string
  label: string
  at: string
}

interface TaskRelatedVisitDto {
  id: string
  visitLabel: string
  dateLabel: string
  timeRange: string
  statusLabel: string
  caregiverName: string | null
  recipientName: string | null
  location: string | null
}

interface TaskRelatedTaskDto {
  id: string
  title: string
  statusLabel: string
  dueDateLabel: string | null
}

export interface TaskDetailDto {
  id: string
  title: string
  description: string | null
  status: string
  statusLabel: string
  priority: string
  priorityLabel: string
  category: string
  categoryLabel: string
  assigneeName: string | null
  recipientName: string | null
  createdByLabel: string
  recurrenceLabel: string | null
  estimatedMinutes: number | null
  dueAt: string | null
  dueDateLabel: string | null
  createdAt: string
  completedAt: string | null
  progress: TaskProgressDto
  checklist: TaskChecklistItemDto[]
  comments: TaskCommentDto[]
  activity: TaskActivityEntryDto[]
  relatedVisit: TaskRelatedVisitDto | null
  relatedTasks: TaskRelatedTaskDto[]
}

interface TaskTemplatesKpisDto {
  activeTemplates: number
  operations: number
  tasksGeneratedThisWeek: number | null
  avgCompletionRatePercent: number | null
}

export interface TaskTemplateCardDto {
  id: string
  name: string
  category: string
  categoryLabel: string
  description: string | null
  itemCount: number
  estimatedMinutes: number | null
  scheduleLabel: string | null
  assigneeLabel: string | null
  active: boolean
  tasksGenerated: number | null
  completionRatePercent: number | null
}

export interface TaskTemplatesScreenDto {
  kpis: TaskTemplatesKpisDto
  templates: TaskTemplateCardDto[]
}

export interface CategorySettingDto {
  category: string
  label: string
  color: string | null
  icon: string | null
  autoAssignLabel: string | null
  tasksCount: number
  active: boolean
}

export interface PrioritySettingDto {
  priority: string
  level: number
  label: string
  color: string | null
  slaHours: number | null
  escalation: string | null
  isDefault: boolean
}

export interface NotificationSettingDto {
  key: string
  title: string
  description: string
  enabled: boolean
  channels: string[]
  channelsLabel: string
}

export interface TaskSettingsDto {
  categories: CategorySettingDto[]
  priorities: PrioritySettingDto[]
  notifications: NotificationSettingDto[]
}

/* --------------------------------- queries -------------------------------- */

export interface TasksListParams {
  tab: TaskTab
  search: string
  priority: BackendPriority | null
  category: BackendCategory | null
  status: BackendStatus | null
  page: number
  pageSize: number
}

export function useTasksScreen(params: TasksListParams) {
  const search = new URLSearchParams({
    tab: params.tab,
    page: String(params.page),
    pageSize: String(params.pageSize),
  })
  if (params.search.trim() !== '') search.set('search', params.search.trim())
  if (params.priority) search.set('priority', params.priority)
  if (params.category) search.set('category', params.category)
  if (params.status) search.set('status', params.status)
  return useQuery({
    queryKey: [
      'admin',
      'tasks',
      'list',
      params.tab,
      params.search.trim(),
      params.priority,
      params.category,
      params.status,
      params.page,
      params.pageSize,
    ],
    queryFn: (): Promise<TasksScreenDto> =>
      api.get<TasksScreenDto>(`/admin/tasks?${search.toString()}`),
  })
}

export function useTaskDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'tasks', 'detail', id],
    queryFn: (): Promise<TaskDetailDto> =>
      api.get<TaskDetailDto>(`/admin/tasks/${id as string}`),
    enabled: Boolean(id),
  })
}

export function useTaskTemplates(params: {
  category: BackendCategory | null
  status: 'ACTIVE' | 'INACTIVE' | null
  search: string
}) {
  const search = new URLSearchParams()
  if (params.category) search.set('category', params.category)
  if (params.status) search.set('status', params.status)
  if (params.search.trim() !== '') search.set('search', params.search.trim())
  const qs = search.toString()
  return useQuery({
    queryKey: ['admin', 'tasks', 'templates', params.category, params.status, params.search.trim()],
    queryFn: (): Promise<TaskTemplatesScreenDto> =>
      api.get<TaskTemplatesScreenDto>(`/admin/tasks/templates${qs ? `?${qs}` : ''}`),
  })
}

export function useTaskSettings() {
  return useQuery({
    queryKey: ['admin', 'tasks', 'settings'],
    queryFn: (): Promise<TaskSettingsDto> => api.get<TaskSettingsDto>('/admin/tasks/settings'),
  })
}

/* -------------------------------- mutations ------------------------------- */

function useInvalidateTasks(): () => void {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: ['admin', 'tasks'] })
  }
}

export interface CreateTaskInput {
  title: string
  description?: string
  priority?: BackendPriority
  category?: BackendCategory
  assigneeLabel?: string
  dueAt?: string
  estimatedMinutes?: number
  checklistItems?: string[]
}

export function useCreateTask(): UseMutationResult<{ id: string }, Error, CreateTaskInput> {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (body: CreateTaskInput) => api.post<{ id: string }>('/admin/tasks', body),
    onSuccess: invalidate,
  })
}

export interface UpdateTaskInput {
  id: string
  title?: string
  description?: string
  priority?: BackendPriority
  category?: BackendCategory
  assigneeLabel?: string
  dueAt?: string
  estimatedMinutes?: number
}

export function useUpdateTask(): UseMutationResult<unknown, Error, UpdateTaskInput> {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateTaskInput) => api.put(`/admin/tasks/${id}`, body),
    onSuccess: invalidate,
  })
}

export function useStartTask(): UseMutationResult<unknown, Error, string> {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (id: string) => api.post(`/admin/tasks/${id}/start`),
    onSuccess: invalidate,
  })
}

export function useCompleteTask(): UseMutationResult<unknown, Error, string> {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (id: string) => api.post(`/admin/tasks/${id}/complete`),
    onSuccess: invalidate,
  })
}

export function useDeleteTask(): UseMutationResult<unknown, Error, string> {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/tasks/${id}`),
    onSuccess: invalidate,
  })
}

export function useSetChecklistItem(): UseMutationResult<
  void,
  Error,
  { taskId: string; itemId: string; done: boolean }
> {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (input: { taskId: string; itemId: string; done: boolean }) =>
      api.put<void>(`/admin/tasks/${input.taskId}/checklist/${input.itemId}`, {
        done: input.done,
      }),
    onSuccess: invalidate,
  })
}

export function useAddComment(): UseMutationResult<
  void,
  Error,
  { taskId: string; body: string }
> {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (input: { taskId: string; body: string }) =>
      api.post<void>(`/admin/tasks/${input.taskId}/comments`, { body: input.body }),
    onSuccess: invalidate,
  })
}

export function useBulkComplete(): UseMutationResult<{ affected: number }, Error, string[]> {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (taskIds: string[]) =>
      api.post<{ affected: number }>('/admin/tasks/bulk/complete', { taskIds }),
    onSuccess: invalidate,
  })
}

/* ---------------------------- template mutations -------------------------- */

export interface TemplateInput {
  name: string
  title: string
  description?: string
  category?: BackendCategory
  priority?: BackendPriority
  defaultAssigneeLabel?: string
  checklistItems?: string[]
  scheduleLabel?: string
  estimatedMinutes?: number
}

export function useCreateTemplate(): UseMutationResult<{ id: string }, Error, TemplateInput> {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (body: TemplateInput) => api.post<{ id: string }>('/admin/tasks/templates', body),
    onSuccess: invalidate,
  })
}

export function useUpdateTemplate(): UseMutationResult<
  unknown,
  Error,
  { id: string } & Partial<TemplateInput>
> {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<TemplateInput>) =>
      api.put(`/admin/tasks/templates/${id}`, body),
    onSuccess: invalidate,
  })
}

export function useDuplicateTemplate(): UseMutationResult<{ id: string }, Error, string> {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (id: string) => api.post<{ id: string }>(`/admin/tasks/templates/${id}/duplicate`),
    onSuccess: invalidate,
  })
}

export function useSetTemplateActive(): UseMutationResult<
  unknown,
  Error,
  { id: string; active: boolean }
> {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (input: { id: string; active: boolean }) =>
      api.post(`/admin/tasks/templates/${input.id}/${input.active ? 'activate' : 'deactivate'}`),
    onSuccess: invalidate,
  })
}

export function useDeleteTemplate(): UseMutationResult<unknown, Error, string> {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/tasks/templates/${id}`),
    onSuccess: invalidate,
  })
}

export interface InstantiateTemplateInput {
  id: string
  dueAt?: string
  assigneeLabel?: string
}

export function useInstantiateTemplate(): UseMutationResult<
  { id: string },
  Error,
  InstantiateTemplateInput
> {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: ({ id, ...body }: InstantiateTemplateInput) =>
      api.post<{ id: string }>(`/admin/tasks/templates/${id}/instantiate`, body),
    onSuccess: invalidate,
  })
}

/* ---------------------------- settings mutations -------------------------- */

export function useUpdateCategorySetting(): UseMutationResult<
  void,
  Error,
  { category: string; color?: string; icon?: string; autoAssignLabel?: string; active?: boolean }
> {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: ({
      category,
      ...body
    }: {
      category: string
      color?: string
      icon?: string
      autoAssignLabel?: string
      active?: boolean
    }) => api.put<void>(`/admin/tasks/settings/categories/${category}`, body),
    onSuccess: invalidate,
  })
}

export function useUpdatePrioritySetting(): UseMutationResult<
  void,
  Error,
  {
    priority: string
    color?: string
    label?: string
    slaHours?: number
    escalation?: string
    isDefault?: boolean
  }
> {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: ({
      priority,
      ...body
    }: {
      priority: string
      color?: string
      label?: string
      slaHours?: number
      escalation?: string
      isDefault?: boolean
    }) => api.put<void>(`/admin/tasks/settings/priorities/${priority}`, body),
    onSuccess: invalidate,
  })
}

export function useUpdateNotificationSetting(): UseMutationResult<
  void,
  Error,
  { key: string; enabled?: boolean; channels?: string[] }
> {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: ({ key, ...body }: { key: string; enabled?: boolean; channels?: string[] }) =>
      api.put<void>(`/admin/tasks/settings/notifications/${key}`, body),
    onSuccess: invalidate,
  })
}
