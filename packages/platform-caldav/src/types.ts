export type CalendarComponent = "event" | "task";

export interface CalDavCredentials {
    object:
        | {
              type: "credentials";
              url: string;
              username: string;
              password: string;
          }
        | {
              type: "credentials";
              url: string;
              token: string;
          };
}

export interface CalendarDescription {
    id: string;
    type: "calendar";
    name: string;
    color?: string;
    components: CalendarComponent[];
}

export interface RecurrenceInput {
    frequency: "daily" | "weekly" | "monthly" | "yearly";
    interval?: number;
    count?: number;
    until?: string;
    byDay?: string[];
    byMonthDay?: number[];
}

export interface PersonInput {
    email: string;
    name?: string;
    role?: "chair" | "required" | "optional" | "non-participant";
    status?:
        | "needs-action"
        | "accepted"
        | "declined"
        | "tentative"
        | "delegated";
    rsvp?: boolean;
}

export interface ReminderInput {
    trigger: string;
    action?: "display" | "email";
    description?: string;
    recipients?: string[];
}

export interface AttachmentInput {
    url?: string;
    data?: string;
    mediaType?: string;
    filename?: string;
}

export interface CalendarObjectInput {
    id?: string;
    etag?: string;
    type: CalendarComponent;
    uid?: string;
    name: string;
    content?: string;
    location?: string;
    url?: string;
    startTime?: string;
    endTime?: string;
    due?: string;
    allDay?: boolean;
    timeZone?: string;
    status?: "needs-action" | "in-process" | "completed" | "cancelled";
    completedTime?: string;
    percentComplete?: number;
    sequence?: number;
    recurrence?: RecurrenceInput;
    organizer?: PersonInput;
    attendees?: PersonInput[];
    reminders?: ReminderInput[];
    attachments?: AttachmentInput[];
}

export interface CalendarItem extends CalendarObjectInput {
    id: string;
    uid: string;
    etag?: string;
    updateSupported: boolean;
}

export interface QueryInput {
    type?: CalendarComponent;
    startTime?: string;
    endTime?: string;
}

export interface DeleteInput {
    id: string;
    type: CalendarComponent;
    etag: string;
}
