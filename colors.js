const getColor = (colorIndex) => {
    let themeColor = null;
    switch (colorIndex) {
        case "1":
            themeColor = "rgba(255, 120, 129, ?)";
            break;
        case "2":
            themeColor = "rgba(251, 187, 131, ?)";
            break;
        case "3":
            themeColor = "rgba(255, 232, 139, ?)";
            break;
        case "4":
            themeColor = "rgba(124, 211, 124, ?)";
            break;
        case "5":
            themeColor = "rgba(134, 223, 226, ?)";
            break;
        case "6":
            themeColor = "rgba(203, 158, 255, ?)";
            break;
        default:
            themeColor = "rgba(162, 162, 162, ?)";
    }
    return {
        border: themeColor.replace("?", "0.5"),
        background: themeColor.replace("?", "0.1"),
        active: themeColor.replace("?", "1")
    }
}