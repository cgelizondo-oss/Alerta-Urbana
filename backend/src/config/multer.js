const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "../../uploads/reportes"));
    },

    filename: (req, file, cb) => {
        const nombreUnico =
            Date.now() + "-" + Math.round(Math.random() * 1E9);

        cb(
            null,
            nombreUnico + path.extname(file.originalname).toLowerCase()
        );
    }
});

const fileFilter = (req, file, cb) => {
    const tiposPermitidos = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (tiposPermitidos.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Solo se permiten imágenes JPG, JPEG, PNG o WebP"));
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

module.exports = upload;