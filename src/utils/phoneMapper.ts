
const phones: Record<string, string> = {
    'Abdullah': '+92304100025',
    'Ahtasham': '+923067555800',
    'Sufyan': '+923094748251',
    'Abubakar': '+923001655553',
    'Ans': '+923081266664',
    'Bilal': '+923036656408',
    'Hammad': '+923036629101',
};

export const getFriendPhone = (name: string): string | undefined => {
    return phones[name];
};
