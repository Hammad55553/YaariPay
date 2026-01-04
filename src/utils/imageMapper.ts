
const images: Record<string, any> = {
    'Abdullah': require('../assets/images/Abdullah.jpeg'),
    'Ahtasham': require('../assets/images/Bukhari.jpeg'),
    'Sufyan': require('../assets/images/Sufyan.jpeg'),
    'Abubakar': require('../assets/images/Abubakar.jpeg'),
    'Ans': require('../assets/images/Ans.jpeg'),
    'Bilal': require('../assets/images/Bilal.jpeg'),
    'Hammad': require('../assets/images/Hammad.jpeg'),
    'default': require('../assets/images/Abubakar.jpeg'), // Fallback
};

export const getFriendImage = (imageName?: string | number) => {
    if (!imageName) return images['default'];
    if (typeof imageName === 'number') return imageName;
    if (images[imageName]) return images[imageName];
    return { uri: imageName };
};
