# Özel yapılandırmalar (her siteye özel class'lar)
SITE_CONFIGS = {
    "example.com": {
        "content_class": "article-content",
        "image_class": "post-image"
    },
    "newswebsite.com": {
        "content_class": "news-body",
        "image_class": "news-image"
    },
    "sokgazetesi.com.tr": {
        "title_class": "h2 fw-bold text-lg-start headline my-2",
        "meta_desc_class": "lead text-lg-start text-dark my-2 description",
        "content_class": "article-text container-padding",
        "image_class": "img-fluid"
    }
}
