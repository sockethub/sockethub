module.exports = (content) => {
    // biome-ignore lint/style/useTemplate: the only way to send irc actions
    return "\x01ACTION " + content + "\x01";
};
