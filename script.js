const API_KEY = "MhDdH7TWjbdGF8BJJ878LrpKMffzTHNpQCLQRDCK";
const BASE_URL = "https://api.nasa.gov/planetary/apod";

const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const searchBtn = document.getElementById("search-btn");
const currentImageContainer = document.getElementById("current-image-container");
const searchHistoryList = document.getElementById("search-history");

function renderData(data) {
    const isVideo = data.media_type === "video";
    const dateText = data.date ? `Picture On ${data.date}` : "Picture of the Day";

    let mediaUrl = data.url;
    if (mediaUrl && mediaUrl.includes("nasa-logo") && data.hdurl) {
        mediaUrl = data.hdurl;
    }

    currentImageContainer.innerHTML = `
    <article class="apod-card">
      <h2>${dateText}</h2>
      ${isVideo
            ? `<iframe src="${mediaUrl}" title="${data.title}" allowfullscreen></iframe>`
            : `<img src="${mediaUrl}" alt="${data.title}" loading="lazy" />`
        }
      <h3>${data.title}</h3>
      <p class="explanation">${data.explanation}</p>
    </article>
  `;
}

function renderError(message) {
    currentImageContainer.innerHTML = `
    <div class="error-message">
      <p>Error: ${message}</p>
    </div>
  `;
}

// Resolves actual space image and details if NASA's legacy planetary/apod scraper returns the broken site header logo
async function resolveRealApodMedia(data, dateStr) {
    if (data && (data.title === "NASA Science" || (data.url && data.url.includes("nasa-logo")))) {
        try {
            const dateToUse = data.date || dateStr;
            let wpUrl = "https://science.nasa.gov/wp-json/wp/v2/apod-basic";
            if (dateToUse) {
                const yymmdd = dateToUse.replace(/-/g, "").slice(2);
                wpUrl += `/${yymmdd}`;
            }
            const wpRes = await fetch(wpUrl, { cache: "no-store" });
            if (wpRes.ok) {
                const wpData = await wpRes.json();
                if (wpData && wpData.title && wpData.title !== "NASA Science") {
                    return {
                        date: wpData.date || dateToUse,
                        title: wpData.title,
                        url: wpData.hdurl || wpData.url,
                        explanation: wpData.explanation,
                        media_type: wpData.media_type || "image"
                    };
                }
            }
        } catch (e) {
            
        }
    }
    return data;
}

async function getCurrentImageOfTheDay() {
    const currentDate = new Date().toISOString().split("T")[0];
    currentImageContainer.innerHTML = `<p class="placeholder-text">Loading Picture of the Day...</p>`;

    try {
        const urlWithDate = `${BASE_URL}?api_key=${API_KEY}&date=${currentDate}`;
        let response = await fetch(urlWithDate, { cache: "no-store" });

        if (!response.ok) {
            const urlWithoutDate = `${BASE_URL}?api_key=${API_KEY}`;
            response = await fetch(urlWithoutDate, { cache: "no-store" });
        }

        if (!response.ok) {
            throw new Error(`Failed to fetch current image (Status: ${response.status})`);
        }

        let data = await response.json();
        data = await resolveRealApodMedia(data, currentDate);
        renderData(data);

        if (data.date) {
            searchInput.value = data.date;
            searchInput.setAttribute("max", data.date);
        }
    } catch (error) {
        renderError(error.message);
    }
}

async function getImageOfTheDay(date) {
    const targetDate = (date || searchInput.value || "").trim();
    if (!targetDate) return;

    searchInput.value = targetDate;
    currentImageContainer.innerHTML = `<p class="placeholder-text">Fetching data for ${targetDate}...</p>`;

    try {
        const url = `${BASE_URL}?api_key=${API_KEY}&date=${targetDate}`;
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) {
            if (response.status === 400) {
                throw new Error(`Date must be between 1995-06-16 and NASA's current date. (Requested: ${targetDate}).`);
            }
            throw new Error(`Failed to fetch image for ${targetDate} (Status: ${response.status})`);
        }

        let data = await response.json();
        data = await resolveRealApodMedia(data, targetDate);

        renderData(data);

        saveSearch(targetDate);
        addSearchToHistory();
    } catch (error) {
        renderError(error.message);
    }
}

function saveSearch(date) {
    const targetDate = (date || searchInput.value || "").trim();
    if (!targetDate) return;

    let searches = JSON.parse(localStorage.getItem("searches")) || [];
    if (!Array.isArray(searches)) {
        searches = [];
    }

    const exists = searches.some(item =>
        (typeof item === "object" && item !== null ? item.date : item) === targetDate
    );

    if (!exists) {
        searches.push({ date: targetDate });
        localStorage.setItem("searches", JSON.stringify(searches));
    }
}

function addSearchToHistory(date) {
    if (date && typeof date === "string") {
        saveSearch(date);
    }

    let searches = JSON.parse(localStorage.getItem("searches")) || [];
    if (!Array.isArray(searches)) {
        searches = [];
    }

    searchHistoryList.innerHTML = "";

    searches.forEach((item) => {
        const searchDate = typeof item === "object" && item !== null ? item.date : item;
        if (!searchDate) return;

        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = "#";
        a.textContent = searchDate;
        li.appendChild(a);

        li.addEventListener("click", (e) => {
            e.preventDefault();
            getImageOfTheDay(searchDate);
        });

        searchHistoryList.appendChild(li);
    });
}

function handleSearchSubmit() {
    const selectedDate = searchInput.value;
    if (selectedDate) {
        getImageOfTheDay(selectedDate);
    }
}

searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    handleSearchSubmit();
});

if (searchBtn) {
    searchBtn.addEventListener("click", (e) => {
        e.preventDefault();
        handleSearchSubmit();
    });
}

searchInput.addEventListener("click", () => {
    try {
        if (typeof searchInput.showPicker === "function") {
            searchInput.showPicker();
        }
    } catch (e) {}
});

window.addEventListener("DOMContentLoaded", () => {
    searchInput.setAttribute("min", "1995-06-16");

    getCurrentImageOfTheDay();
    addSearchToHistory();
});
