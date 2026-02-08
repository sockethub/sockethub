module.exports = (content) => {
    // biome-ignore lint/style/useTemplate: <explanation>
    return "\x01ACTION " + content + "\x01";
};
