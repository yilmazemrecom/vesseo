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
                    { model: 'heading2', view: 'h3', title: 'Heading 2', class: 'ck-heading_heading2' },
                    { model: 'heading3', view: 'h4', title: 'Heading 3', class: 'ck-heading_heading3' }
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
        document.getElementById("analysisResult").classList.remove("d-none");

        // ✅ BAŞARILAR (İyi Yapılanlar)
        document.getElementById("successes").innerHTML = "";
        if (data.title_length >= 50) {
            document.getElementById("successes").innerHTML += `<li class="text-success">✅ Başlık uzunluğu yeterli!</li>`;
        }
        if (data.meta_desc_length >= 120) {
            document.getElementById("successes").innerHTML += `<li class="text-success">✅ Meta açıklaması uygun!</li>`;
        }
        if (data.word_count >= 300) {
            document.getElementById("successes").innerHTML += `<li class="text-success">✅ İçerik uzunluğu yeterli!</li>`;
        }
        if (data.h2_count >= 2) {
            document.getElementById("successes").innerHTML += `<li class="text-success">✅ H2 başlık sayısı ideal!</li>`;
        }
        if (data.alt_analysis.status === "Tamam") {
            document.getElementById("successes").innerHTML += `<li class="text-success">✅ Tüm görseller ALT metnine sahip!</li>`;
        }

        if (document.getElementById("successes").innerHTML.trim() === "") {
            document.getElementById("successes").innerHTML = `<li class="text-warning">⚠️ İyileştirme önerilerini ve hatalarınızı kontrol ediniz!</li>`;
        }

        // 📌 İyileştirme Önerileri
        const suggestionsList = data.recommendations
            .map(rec => `<li class="text-primary">🧷 ${rec}</li>`).join("");

        document.getElementById("suggestions").innerHTML = suggestionsList || "<li class='text-success'>✅ Çok iyi iş, herhangi bir iyileştirme önerisi bulunamadı!</li>";

        // ⚠️ Yapılması Gerekenler
        const improvementsList = data.recommendations
            .filter(rec => rec.includes("olmalıdır"))
            .map(rec => `<li class="text-warning">⚠️ ${rec}</li>`).join("");

        document.getElementById("improvements").innerHTML = improvementsList || "<li class='text-success'>✅ Her şey yolunda, yapılması gereken bir işlem bulunamadı!</li>";

        // ❌ Hatalar
        const errorsList = data.recommendations
            .filter(rec => rec.includes("eksik") || rec.includes("kısa"))
            .map(rec => `<li class="text-danger">❌ ${rec}</li>`).join("");

        document.getElementById("errors").innerHTML = errorsList || "<li class='text-success'>✅ Harika! Herhangi bir hata tespit edilmedi!</li>";


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

        let imageResultsContainer = document.getElementById("imageResults");
        imageResultsContainer.innerHTML = ""; // Önceki sonuçları temizle

        data.image_analysis.forEach((img) => {
            let resultHTML = `
                <div class="alert alert-info">
                    <h5>📊 ${img.file_name}</h5>
                    ${img.error ? `<p class="text-danger">${img.error}</p>` : `
                        <ul>
                            <li>Format: <strong>${img.analysis.format}</strong></li>
                            <li>Dosya Boyutu: <strong>${img.analysis.file_size_kb} KB / ${img.analysis.file_size_mb} MB</strong></li>
                            <li>Boyut Durumu: <strong>${img.analysis.size_status}</strong></li>
                            <li>Format Durumu: <strong>${img.analysis.format_status}</strong></li>
                        </ul>
                    `}
                </div>
            `;

            imageResultsContainer.innerHTML += resultHTML;
        });

        document.getElementById("title_length").innerText = data.title_length || 0;
        document.getElementById("word_count").innerText = data.word_count || 0;
        document.getElementById("meta_desc_length").innerText = data.meta_desc_length || 0;
        document.getElementById("image_count").innerText = data.image_count || 0;
    
        // Renk değişimleri (Yeşil / Sarı / Kırmızı)
        updateCardColor("title_length", data.title_length, 50, 60);
        updateCardColor("word_count", data.word_count, 300, 500);
        updateCardColor("meta_desc_length", data.meta_desc_length, 150, 160);
        updateCardColor("image_count", data.image_count, 1, 5);
    
    
    })
    .catch(error => {
        console.error("❌ SEO Analizi yapılırken hata oluştu:", error);
        document.getElementById("errors").innerHTML = `<li class="text-danger">🚨 Sunucu hatası! Lütfen daha sonra tekrar deneyin.</li>`;
    });
});

function updateCardColor(id, value, min, max) {
    const element = document.getElementById(id);
    if (value < min) {
        element.classList.remove("text-success", "text-warning");
        element.classList.add("text-danger");
    } else if (value > max) {
        element.classList.remove("text-success", "text-danger");
        element.classList.add("text-warning");
    } else {
        element.classList.remove("text-danger", "text-warning");
        element.classList.add("text-success");
    }
}



