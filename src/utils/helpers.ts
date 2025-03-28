
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

export const timeAgo = (date: Date) => {
    const releaseDate = calculateRelativeDate(date);
    const days = Math.floor(releaseDate);
    if (days > 0) return `${days}d${days === 1 ? '' : ''} ago`
    else if (days < 0) return `in ${Math.abs(days)}d`
    else return 'today'
};