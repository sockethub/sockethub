declare module "@xmpp/resolve/lib/http.js" {
    const http: { resolve(domain: string): Promise<unknown[]> };
    export default http;
}
