declare const crypto: {
    encrypt: (json: any, secret: any) => string;
    decrypt: (string: any, secret: any) => any;
};
export default crypto;
