document.addEventListener("DOMContentLoaded", function () {
    const editorElement = document.querySelector("#editor");

    if (!editorElement) {
        console.error("❌ CKEditor öğesi bulunamadı!");
        return;
    }

    ClassicEditor
        .create(editorElement, {
            extraPlugins: [CustomUploadAdapterPlugin],
            heading: {
                options: [
                    { model: 'paragraph', title: 'Paragraph', class: 'ck-heading_paragraph' },
                    { model: 'heading2', view: 'h2', title: 'Heading 2', class: 'ck-heading_heading2' },
                    { model: 'heading3', view: 'h3', title: 'Heading 3', class: 'ck-heading_heading3' }
                ]
            }
        })
        .then(editor => {
            window.editorInstance = editor;
            console.log("✅ CKEditor başarıyla yüklendi.");
        })
        .catch(error => {
            console.error("❌ CKEditor yüklenirken hata oluştu:", error);
        });
});

// 📌 CKEditor için Özel Görsel Yükleme Adaptörü
class CustomUploadAdapter {
    constructor(loader) {
        this.loader = loader;
    }

    upload() {
        return this.loader.file
            .then(file => new Promise((resolve, reject) => {
                const data = new FormData();
                data.append("file", file);

                fetch("/upload-image/", {
                    method: "POST",
                    body: data
                })
                .then(response => response.json())
                .then(result => {
                    if (result.url) {
                        resolve({ default: result.url });

                    } else {
                        reject("❌ Görsel yüklenirken hata oluştu!");
                    }
                })
                .catch(error => {
                    console.error("❌ Görsel yükleme hatası:", error);
                    reject("⚠️ Görsel yüklenirken bilinmeyen bir hata oluştu.");
                });
            }));
    }
}


function CustomUploadAdapterPlugin(editor) {
    editor.plugins.get("FileRepository").createUploadAdapter = loader => {
        return new CustomUploadAdapter(loader);
    };
}


// 📌 SEO Analiz İsteği
document.getElementById("analyzeBtn").addEventListener("click", function () {
    const title = document.getElementById("title").value.trim();
    const metaDesc = document.getElementById("meta_desc").value.trim();
    const content = window.editorInstance.getData().trim();

    if (!title || !metaDesc || !content) {
        alert("⚠️ Lütfen başlık, meta açıklaması ve içerik alanlarını doldurun!");
        return;
    }

    const formData = new URLSearchParams();
    formData.append("title", title);
    formData.append("meta_desc", metaDesc);
    formData.append("content", content);

    fetch("/content-analysis/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString()
    })
    .then(response => response.json())
    .then(data => {
        if (!data || typeof data !== "object") {
            console.error("❌ Sunucudan geçersiz yanıt alındı!");
            return;
        }

        document.getElementById("analysisResult").classList.remove("d-none");

        // **✅ Başarılar**
        let successContainer = document.getElementById("successes");
        if (successContainer) {
            successContainer.innerHTML = "";
            let successList = [];
            if (data.title_length >= 50) successList.push("✅ Başlık uzunluğu yeterli!");
            if (data.meta_desc_length >= 120) successList.push("✅ Meta açıklaması uygun!");
            if (data.word_count >= 300) successList.push("✅ İçerik uzunluğu yeterli!");
            if (data.h2_count >= 2) successList.push("✅ H2 başlık sayısı ideal!");
            if (data.alt_analysis.status === "Tamam") successList.push("✅ Tüm görseller ALT metnine sahip!");

            successContainer.innerHTML = successList.length
                ? successList.map(msg => `<li class="text-success">${msg}</li>`).join("")
                : `<li class="text-warning">⚠️ İyileştirme önerilerini ve hatalarınızı kontrol ediniz!</li>`;
        }

        // **📌 İyileştirme Önerileri**
        let suggestionContainer = document.getElementById("suggestions");
        if (suggestionContainer) {
            let suggestions = data.recommendations.filter(rec =>
                !rec.includes("olmalıdır") && !rec.includes("eksik") && !rec.includes("hata")
            );
            suggestionContainer.innerHTML = suggestions.length
                ? suggestions.map(msg => `<li class="text-primary">🧷 ${msg}</li>`).join("")
                : "<li class='text-success'>✅ Herhangi bir iyileştirme önerisi bulunamadı!</li>";
        }

        // **⚠ Yapılması Gerekenler**
        let improvementContainer = document.getElementById("improvements");
        if (improvementContainer) {
            let improvements = data.recommendations.filter(rec => rec.includes("olmalıdır"));
            improvementContainer.innerHTML = improvements.length
                ? improvements.map(msg => `<li class="text-warning">⚠️ ${msg}</li>`).join("")
                : "<li class='text-success'>✅ Her şey yolunda, yapılması gereken bir işlem bulunamadı!</li>";
        }

        // **❌ Hatalar**
        let errorContainer = document.getElementById("errors");
        if (errorContainer) {
            let errors = data.recommendations.filter(rec =>
                rec.includes("eksik") || rec.includes("hata") || rec.includes("yanlış")
            );

            // **Görsel Yoksa Hata Olarak Ekle**
            if (data.image_count === 0) {
                errors.push("🚨 İçeriğinizde hiç görsel bulunmuyor! En az bir görsel eklemelisiniz.");
            }

            errorContainer.innerHTML = errors.length
                ? errors.map(msg => `<li class="text-danger">❌ ${msg}</li>`).join("")
                : "<li class='text-success'>✅ Harika! Herhangi bir hata tespit edilmedi!</li>";
        }

        // 📌 **Ana Sayaçları Güncelle**
        updateTextContent("title_length", data.title_length);
        updateTextContent("word_count", data.word_count);
        updateTextContent("meta_desc_length", data.meta_desc_length);
        updateTextContent("image_count", data.image_count);

        // 📖 Okunabilirlik Skoru
        updateTextContent("readability_score", data.readability_score.toFixed(2));

        // 🔑 Anahtar Kelime Dağılımı
        updateTextContent("keyword_density", data.keyword_density.map(k => `${k[0]} (${k[1]} kez)`).join(", "));

        // 📏 Ortalama Cümle Uzunluğu
        let avgSentenceLength = (data.sentence_lengths.reduce((a, b) => a + b, 0) / data.sentence_lengths.length).toFixed(2);
        updateTextContent("sentence_length", avgSentenceLength);

        // 🎭 Duygu Analizi
        updateTextContent("sentiment", data.sentiment);

// 📌 Görsel ALT Metni ve diğer Analiz Sonuçlarını Göster
if (data.alt_analysis.status === "Eksik ALT") {
    document.getElementById("altWarning").classList.remove("d-none");
    document.getElementById("altWarning").innerHTML = `
        <li class="text-danger">⚠️ ${data.alt_analysis.message}</li>
    `;
} 
else if (data.alt_analysis.status === "no_images") {
    document.getElementById("altWarning").classList.remove("d-none");
    document.getElementById("altWarning").innerHTML =
        `<li class="text-danger">⚠️ ${data.alt_analysis.message}</li>`;
} 
else {
    document.getElementById("altWarning").classList.add("d-none");
}

// 📌 Görsel Analiz Sonuçları ve ALT Metni Kontrolleri
let imageResultsContainer = document.getElementById("imageResults");
imageResultsContainer.innerHTML = ""; // Önceki sonuçları temizle

data.image_analysis.forEach((img) => {
    let imgSrc = img.file_path ? img.file_path : "https://via.placeholder.com/100x60?text=Görsel+Bulunamadı"; 

    // 📌 Eğer analiz bilgisi yoksa, boş değerler atayalım
    let imgAnalysis = img.analysis || {
        format: "Bilinmiyor",
        file_size_kb: "?",
        file_size_mb: "?",
        size_status: "Bilinmiyor",
        format_status: "Bilinmiyor"
    };

    let resultHTML = `
        <div class="alert alert-info">
            <h5>📊 ${img.file_name || "Bilinmeyen Görsel"}</h5>
            ${img.error ? `<p class="text-danger">${img.error}</p>` : ""}
            <ul>
                <li>📁 <strong>Görsel Yolu:</strong> <a href="${imgSrc}" target="_blank">${img.file_name}</a></li>
                <li>📁 <strong>Format:</strong> ${imgAnalysis.format}</li>
                <li>📏 <strong>Dosya Boyutu:</strong> ${imgAnalysis.file_size_kb} KB / ${imgAnalysis.file_size_mb} MB</li>
                <li>📌 <strong>Boyut Durumu:</strong> ${imgAnalysis.size_status}</li>
                <li>🖼️ <strong>Format Durumu:</strong> ${imgAnalysis.format_status}</li>
            </ul>
        </div>
    `;

    imageResultsContainer.innerHTML += resultHTML;
});



        // 📌 Renk Değişimi
        updateCardColor("word_count", data.word_count, 300, 1000);
        updateCardColor("title_length", data.title_length, 50, 60);
        updateCardColor("meta_desc_length", data.meta_desc_length, 120, 160);
        updateCardColor("image_count", data.image_count, 1, 5);
    })
    .catch(error => {
        console.error("❌ SEO Analizi yapılırken hata oluştu:", error);
        let errorContainer = document.getElementById("errors");
        if (errorContainer) {
            errorContainer.innerHTML = `<li class="text-danger">🚨 Sunucu hatası! Lütfen daha sonra tekrar deneyin.</li>`;
        }
    });
});

// **🛠 ID Kontrolü ve Güncelleme Fonksiyonu**
function updateTextContent(id, value) {
    let element = document.getElementById(id);
    if (element) {
        element.textContent = value || "-";
    } else {
        console.warn(`⚠ ID bulunamadı: ${id}`);
    }
}


function updateCardColor(id, value, min, max) {
    const element = document.getElementById(id);

    if (!element || isNaN(value)) {
        console.warn(`⚠ updateCardColor: "${id}" için geçersiz değer!`);
        return;
    }

    element.classList.remove("text-success", "text-warning", "text-danger");

    if (value < min) {
        element.classList.add("text-danger"); // Kırmızı - Yetersiz
    } else if (value >= min && value <= max) {
        element.classList.add("text-success"); // Yeşil - İdeal
    } else {
        element.classList.add("text-warning"); // Sarı - Fazla
    }
}

