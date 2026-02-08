module.exports = (content) => {
    // biome-ignore lint/style/useTemplate: IRC ACTION wrapper expects raw concatenation
    return "\x01ACTION " + content + "\x01";
};
