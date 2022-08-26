export {default as CredentialsStore} from "./credentials-store";
export {default as JobQueue} from "./job-queue";
export * from "./types";

// export default class DataLayer {
//   readonly uid: string;
//   readonly jobQueue: JobQueue;
//   readonly credentialStore: CredentialsStore;
//
//   constructor(instanceId: string, sessionId: string, secret: string, redisConfig: RedisConfig) {
//     this.uid = `sockethub:data-layer:job-queue:${instanceId}:${sessionId}`;
//     this.jobQueue = new JobQueue(
//       instanceId, sessionId, secret, redisConfig
//     ),
//     this.credentialStore = new CredentialsStore(
//       instanceId, sessionId, secret, redisConfig
//     );
//   }
// }