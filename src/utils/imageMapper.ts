
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

    // Exact match
    if (images[imageName]) return images[imageName];

    // Partial match (e.g. "Ahtashm bukhari" should match "Ahtasham" or "Bukhari")
    const lowerName = imageName.toLowerCase();
    const foundKey = Object.keys(images).find(key =>
        key !== 'default' && lowerName.includes(key.toLowerCase())
    );
    if (foundKey) return images[foundKey];

    // Additional fuzzy checks for known misspellings if needed
    if (lowerName.includes('ahtashm')) return images['Ahtasham'];

    // If it looks like a URL, use it
    if (imageName.startsWith('http') || imageName.startsWith('file://')) {
        return { uri: imageName };
    }

    return images['default'];
};
