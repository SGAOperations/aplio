import {
  Activity,
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Briefcase,
  CalendarCheck,
  Check,
  ChevronDown,
  CircleCheck,
  CircleDot,
  CircleSlash,
  CircleX,
  Clock,
  Download,
  Ellipsis,
  Eye,
  EyeOff,
  FileImage,
  FilePen,
  FileQuestionMark,
  FileText,
  FileType,
  FunnelX,
  GripVertical,
  Hourglass,
  House,
  Inbox,
  Info,
  ListChecks,
  LoaderCircle,
  LogOut,
  type LucideIcon,
  Mail,
  OctagonAlert,
  Pencil,
  Plus,
  RotateCcw,
  SearchX,
  Send,
  ShieldCheck,
  ShieldOff,
  Trash2,
  TriangleAlert,
  UserMinus,
  UserPen,
  UserPlus,
  UserRoundX,
  Users,
  X,
} from 'lucide-react';

import type { $Enums } from '@/prisma/client';

import type { PositionAvailability } from '@/lib/types';

type Concept =
  | 'home'
  | 'position'
  | 'application'
  | 'myApplication'
  | 'user'
  | 'question'
  | 'profile'
  | 'activity';

export const CONCEPT_ICONS: Record<Concept, LucideIcon> = {
  home: House,
  position: Briefcase,
  application: Inbox,
  myApplication: FileText,
  user: Users,
  question: ListChecks,
  profile: UserPen,
  activity: Activity,
};

export const APPLICATION_STATUS_ICONS: Record<
  $Enums.ApplicationStatus,
  LucideIcon
> = {
  draft: FilePen,
  applied: Send,
  reached_out: Mail,
  interview_scheduled: CalendarCheck,
  reviewing: Eye,
  accepted: CircleCheck,
  rejected: CircleX,
  withdrawn: CircleSlash,
};

export const POSITION_AVAILABILITY_ICONS: Record<
  PositionAvailability,
  LucideIcon
> = {
  accepting: CircleDot,
  upcoming: Clock,
  closed_by_date: CircleSlash,
  unavailable: CircleSlash,
};

export const POSITION_STATUS_ICONS: Record<$Enums.PositionStatus, LucideIcon> =
  { draft: FilePen, open: CircleDot, closed: CircleSlash };

type Action =
  | 'create'
  | 'edit'
  | 'delete'
  | 'save'
  | 'submit'
  | 'download'
  | 'back'
  | 'goTo'
  | 'retry'
  | 'signOut'
  | 'addManager'
  | 'removeManager'
  | 'deactivate'
  | 'promote'
  | 'demote'
  | 'clearFilters'
  | 'pending'
  | 'more'
  | 'dismiss'
  | 'drag'
  | 'expand'
  | 'sortAsc'
  | 'sortDesc'
  | 'sortNone';

export const ACTION_ICONS: Record<Action, LucideIcon> = {
  create: Plus,
  edit: Pencil,
  delete: Trash2,
  save: Check,
  submit: Send,
  download: Download,
  back: ArrowLeft,
  goTo: ArrowRight,
  retry: RotateCcw,
  signOut: LogOut,
  addManager: UserPlus,
  removeManager: UserMinus,
  deactivate: UserRoundX,
  promote: ShieldCheck,
  demote: ShieldOff,
  clearFilters: FunnelX,
  pending: LoaderCircle,
  more: Ellipsis,
  dismiss: X,
  drag: GripVertical,
  expand: ChevronDown,
  sortAsc: ArrowUp,
  sortDesc: ArrowDown,
  sortNone: ArrowUpDown,
};

type State =
  | 'error'
  | 'notFound'
  | 'rateLimited'
  | 'warning'
  | 'info'
  | 'hidden'
  | 'archived'
  | 'noResults';

export const STATE_ICONS: Record<State, LucideIcon> = {
  error: OctagonAlert,
  notFound: FileQuestionMark,
  rateLimited: Hourglass,
  warning: TriangleAlert,
  info: Info,
  hidden: EyeOff,
  archived: Archive,
  noResults: SearchX,
};

type FileTypeKind = 'pdf' | 'image';

export const FILE_TYPE_ICONS: Record<FileTypeKind, LucideIcon> = {
  pdf: FileType,
  image: FileImage,
};
