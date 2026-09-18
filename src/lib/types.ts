// API authority: anke-sports-cloud/contracts/openapi.json.
// Run `npm run contracts` after exporting a backend contract change.
import type { components } from "./generated";
type Schemas = components["schemas"];
export type Source = Schemas["SourceView"];
export type Participant = Schemas["ParticipantView"];
export type EventLink = Schemas["LinkView"];
export type SportEvent = Schemas["EventView"];
export type Preferences = Schemas["Preferences-Output"];
export type Follow = Schemas["Follow"];
export type Config = Schemas["Config-Output"];
export type CalendarUser = Schemas["CalendarUserView"];
export type AccountDeletion = Schemas["AccountDeletionView"];
export type ServiceStatus = Schemas["ServiceStatusView"];
export type ImportPreview = Schemas["ImportPreviewView"];
export type ManualEventSource = Schemas["ManualEventSource"];
export type CalendarSource = Schemas["CalendarSourceView"];
export type CalendarMembership = Schemas["CalendarMembershipView"];

export type AuthProfile = {
  displayName: string;
  photoURL: string | null;
};

export type FollowPreviewView = Schemas["FollowPreviewView"];
