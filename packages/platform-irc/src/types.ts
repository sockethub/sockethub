import { ActivityActor, CredentialsObject } from "@sockethub/schemas";

export interface PlatformIrcCredentialsObject extends CredentialsObject {
  context: "irc";
  type: "credentials";
  actor: ActivityActor;
  target?: ActivityActor;
  object: {
    type: "credentials";
    nick: string;
    server: string;
    username?: string;
    password?: string;
    port?: number;
    secure?: boolean;
    sasl?: boolean;
  };
}
