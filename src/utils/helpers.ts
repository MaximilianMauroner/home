export const calculateRelativeDate = (releaseDate: Date) => {
    const date2 = new Date();
    const diffTime = date2.getTime() - releaseDate.getTime();
    const days = diffTime / (1000 * 3600 * 24);
    return Math.floor(days);
};

export const kebabCase = (str: string) =>
    str
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .replace(/[\s_]+/g, "-")
        .toLowerCase();

