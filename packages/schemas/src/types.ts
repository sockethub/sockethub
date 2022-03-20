export interface IActivityStream {
  type: string;
  context: string;
  actor: IActivityObjectActor;
  object?: IActivityObjectObject;
  target?: IActivityObjectActor;
  error?: string;
  sessionSecret?: string;
}

export interface IActivityObject {
  id: string;
  type: string;
}

export interface IActivityObjectActor extends IActivityObject {
  name?: string;
}

export interface IActivityObjectObject extends IActivityObject {
  content?: any;
}