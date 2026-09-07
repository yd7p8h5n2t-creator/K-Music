/* =========================================================
   K-MUSIC V2
   Bibliothèque locale + métadonnées + favoris + lecteur
========================================================= */


/* =========================================================
   ELEMENTS
========================================================= */

const audio = document.getElementById("audio");

const musicInput = document.getElementById("musicInput");

const addMusic = document.getElementById("addMusic");
const addFirstMusic = document.getElementById("addFirstMusic");

const library = document.getElementById("library");

const search = document.getElementById("search");

const songCount = document.getElementById("songCount");

const miniPlayer = document.getElementById("miniPlayer");

const miniCover = document.getElementById("miniCover");
const miniTitle = document.getElementById("miniTitle");
const miniArtist = document.getElementById("miniArtist");

const miniPlay = document.getElementById("miniPlay");
const miniPrevious = document.getElementById("miniPrevious");
const miniNext = document.getElementById("miniNext");

const miniProgress = document.getElementById("miniProgress");

const openPlayer = document.getElementById("openPlayer");

const playerScreen = document.getElementById("playerScreen");

const closePlayer = document.getElementById("closePlayer");

const bigCover = document.getElementById("bigCover");

const bigTitle = document.getElementById("bigTitle");
const bigArtist = document.getElementById("bigArtist");

const playerFavorite = document.getElementById("playerFavorite");

const play = document.getElementById("play");

const previous = document.getElementById("previous");
const next = document.getElementById("next");

const shuffle = document.getElementById("shuffle");
const repeat = document.getElementById("repeat");

const progress = document.getElementById("progress");

const currentTime = document.getElementById("currentTime");
const duration = document.getElementById("duration");


/* =========================================================
   VARIABLES
========================================================= */

let songs = [];

let currentSong = -1;

let shuffleEnabled = false;

let repeatEnabled = false;

let currentFilter = "all";

let database;


/* =========================================================
   DATABASE INDEXEDDB
========================================================= */

function openDatabase() {

    return new Promise((resolve, reject) => {

        const request = indexedDB.open(
            "KMusicDatabase",
            1
        );


        request.onupgradeneeded = event => {

            const db = event.target.result;

            if (!db.objectStoreNames.contains("songs")) {

                db.createObjectStore(
                    "songs",
                    {
                        keyPath: "id"
                    }
                );

            }

        };


        request.onsuccess = event => {

            database = event.target.result;

            resolve(database);

        };


        request.onerror = () => {

            reject(request.error);

        };

    });

}


/* =========================================================
   SAUVEGARDE
========================================================= */

function saveSong(song) {

    return new Promise((resolve, reject) => {

        const transaction =
            database.transaction(
                ["songs"],
                "readwrite"
            );

        const store =
            transaction.objectStore("songs");

        store.put(song);

        transaction.oncomplete = resolve;

        transaction.onerror = () => {
            reject(transaction.error);
        };

    });

}


/* =========================================================
   SUPPRESSION
========================================================= */

function deleteSong(id) {

    return new Promise((resolve, reject) => {

        const transaction =
            database.transaction(
                ["songs"],
                "readwrite"
            );

        const store =
            transaction.objectStore("songs");

        store.delete(id);

        transaction.oncomplete = resolve;

        transaction.onerror = () => {
            reject(transaction.error);
        };

    });

}


/* =========================================================
   CHARGER LES MORCEAUX
========================================================= */

function loadSongs() {

    return new Promise((resolve, reject) => {

        const transaction =
            database.transaction(
                ["songs"],
                "readonly"
            );

        const store =
            transaction.objectStore("songs");

        const request =
            store.getAll();

        request.onsuccess = () => {

            songs = request.result || [];

            resolve();

        };

        request.onerror = () => {

            reject(request.error);

        };

    });

}


/* =========================================================
   INITIALISATION
========================================================= */

async function init() {

    try {

        await openDatabase();

        await loadSongs();

        renderLibrary();

    } catch (error) {

        console.error(
            "Impossible d'ouvrir la bibliothèque",
            error
        );

    }

}

init();


/* =========================================================
   AJOUT DE MUSIQUE
========================================================= */

function openFilePicker() {

    musicInput.click();

}

addMusic.addEventListener(
    "click",
    openFilePicker
);

addFirstMusic.addEventListener(
    "click",
    openFilePicker
);


musicInput.addEventListener(
    "change",
    async event => {

        const files =
            Array.from(event.target.files);


        for (const file of files) {

            if (
                !file.type.startsWith("audio/") &&
                !isAudioExtension(file.name)
            ) {

                continue;

            }


            const id =
                crypto.randomUUID();


            const song = {

                id: id,

                name: file.name,

                title: removeExtension(file.name),

                artist: "Artiste inconnu",

                album: "Album inconnu",

                year: "",

                artwork: null,

                favorite: false,

                file: file

            };


            try {

                const metadata =
                    await readMetadata(file);

                if (metadata) {

                    if (metadata.title) {
                        song.title = metadata.title;
                    }

                    if (metadata.artist) {
                        song.artist = metadata.artist;
                    }

                    if (metadata.album) {
                        song.album = metadata.album;
                    }

                    if (metadata.year) {
                        song.year = metadata.year;
                    }

                    if (metadata.artwork) {
                        song.artwork =
                            metadata.artwork;
                    }

                }

            } catch (error) {

                console.log(
                    "Métadonnées non disponibles",
                    error
                );

            }


            await saveSong(song);

            songs.push(song);

        }


        musicInput.value = "";

        renderLibrary();

    }
);


/* =========================================================
   LECTURE DES MÉTADONNÉES
========================================================= */

function readMetadata(file) {

    return new Promise(resolve => {

        if (
            typeof jsmediatags === "undefined"
        ) {

            resolve(null);

            return;

        }


        jsmediatags.read(
            file,
            {

                onSuccess: tag => {

                    const tags =
                        tag.tags || {};


                    let artwork = null;


                    if (tags.picture) {

                        const picture =
                            tags.picture;


                        const bytes =
                            new Uint8Array(
                                picture.data
                            );


                        let binary = "";

                        for (
                            let i = 0;
                            i < bytes.length;
                            i++
                        ) {

                            binary +=
                                String.fromCharCode(
                                    bytes[i]
                                );

                        }


                        artwork =
                            `data:${picture.format};base64,${btoa(binary)}`;

                    }


                    resolve({

                        title: tags.title || "",

                        artist:
                            tags.artist || "",

                        album:
                            tags.album || "",

                        year:
                            tags.year || "",

                        artwork: artwork

                    });

                },


                onError: () => {

                    resolve(null);

                }

            }
        );

    });

}


/* =========================================================
   AFFICHER LA BIBLIOTHÈQUE
========================================================= */

function renderLibrary() {

    const query =
        search.value
            .trim()
            .toLowerCase();


    let visibleSongs =
        songs.filter(song => {

            const matchesSearch =

                song.title
                    .toLowerCase()
                    .includes(query)

                ||

                song.artist
                    .toLowerCase()
                    .includes(query)

                ||

                song.album
                    .toLowerCase()
                    .includes(query);


            const matchesFilter =

                currentFilter === "all"

                ||

                (
                    currentFilter === "favorites"
                    &&
                    song.favorite
                );


            return (
                matchesSearch &&
                matchesFilter
            );

        });


    songCount.textContent =
        `${songs.length} ${
            songs.length > 1
                ? "morceaux"
                : "morceau"
        }`;


    library.innerHTML = "";


    if (visibleSongs.length === 0) {

        library.innerHTML = `

            <div class="empty">

                <div class="empty-cover">
                    ♪
                </div>

                <h3>
                    ${
                        songs.length === 0
                            ? "Ta bibliothèque est vide"
                            : "Aucun résultat"
                    }
                </h3>

                <p>
                    ${
                        songs.length === 0
                            ? "Ajoute tes morceaux pour commencer."
                            : "Essaie une autre recherche."
                    }
                </p>

            </div>

        `;

        return;

    }


    visibleSongs.forEach(song => {

        const index =
            songs.findIndex(
                item => item.id === song.id
            );


        const element =
            document.createElement("div");


        element.className = "song";


        const artwork =
            song.artwork
                ? `<img src="${song.artwork}">`
                : "♪";


        element.innerHTML = `

            <div class="song-cover">
                ${artwork}
            </div>

            <div class="song-info">

                <div class="song-title">
                    ${escapeHTML(song.title)}
                </div>

                <div class="song-artist">
                    ${escapeHTML(song.artist)}
                </div>

            </div>

            <button
                class="song-heart ${
                    song.favorite
                        ? "favorite"
                        : ""
                }"
                data-heart="${song.id}"
            >
                ${song.favorite ? "♥" : "♡"}
            </button>

        `;


        element.addEventListener(
            "click",
            event => {

                if (
                    event.target.closest(
                        ".song-heart"
                    )
                ) {

                    return;

                }


                playSong(index);

            }
        );


        const heart =
            element.querySelector(
                ".song-heart"
            );


        heart.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                toggleFavorite(index);

            }
        );


        library.appendChild(element);

    });

}


/* =========================================================
   FAVORIS
========================================================= */

async function toggleFavorite(index) {

    if (!songs[index]) return;


    songs[index].favorite =
        !songs[index].favorite;


    await saveSong(
        songs[index]
    );


    updateFavoriteUI();

    renderLibrary();

}


function updateFavoriteUI() {

    if (currentSong < 0) return;


    const song =
        songs[currentSong];


    playerFavorite.textContent =
        song.favorite
            ? "♥"
            : "♡";

}


/* =========================================================
   LECTURE D'UN MORCEAU
========================================================= */

function playSong(index) {

    if (!songs[index]) return;


    currentSong = index;


    const song =
        songs[currentSong];


    if (audio.src) {

        URL.revokeObjectURL(
            audio.dataset.objectUrl || ""
        );

    }


    const objectUrl =
        URL.createObjectURL(
            song.file
        );


    audio.dataset.objectUrl =
        objectUrl;


    audio.src =
        objectUrl;


    updatePlayer(song);


    audio.play()
        .then(() => {

            updatePlayButtons();

        })
        .catch(error => {

            console.error(
                "Lecture impossible",
                error
            );

        });

}


/* =========================================================
   METTRE À JOUR LE PLAYER
========================================================= */

function updatePlayer(song) {

    miniTitle.textContent =
        song.title;

    miniArtist.textContent =
        song.artist;


    bigTitle.textContent =
        song.title;

    bigArtist.textContent =
        song.artist;


    const artwork =
        song.artwork;


    if (artwork) {

        miniCover.innerHTML =
            `<img src="${artwork}">`;

        bigCover.innerHTML =
            `<img src="${artwork}">`;

    } else {

        miniCover.innerHTML = "♪";

        bigCover.innerHTML = "♪";

    }


    miniPlayer.classList.remove(
        "hidden"
    );


    updateFavoriteUI();

}


/* =========================================================
   PLAY / PAUSE
========================================================= */

function togglePlay() {

    if (currentSong === -1) return;


    if (audio.paused) {

        audio.play();

    } else {

        audio.pause();

    }

}


play.addEventListener(
    "click",
    togglePlay
);

miniPlay.addEventListener(
    "click",
    togglePlay
);


/* =========================================================
   BOUTONS LECTURE
========================================================= */

audio.addEventListener(
    "play",
    updatePlayButtons
);

audio.addEventListener(
    "pause",
    updatePlayButtons
);


function updatePlayButtons() {

    const symbol =
        audio.paused
            ? "▶"
            : "Ⅱ";


    play.textContent =
        symbol;

    miniPlay.textContent =
        symbol;

}


/* =========================================================
   SUIVANT
========================================================= */

function nextSong() {

    if (songs.length === 0) return;


    let nextIndex;


    if (shuffleEnabled) {

        if (songs.length === 1) {

            nextIndex = currentSong;

        } else {

            do {

                nextIndex =
                    Math.floor(
                        Math.random() *
                        songs.length
                    );

            } while (
                nextIndex === currentSong
            );

        }

    } else {

        nextIndex =
            currentSong + 1;


        if (
            nextIndex >= songs.length
        ) {

            nextIndex = 0;

        }

    }


    playSong(nextIndex);

}


next.addEventListener(
    "click",
    nextSong
);

miniNext.addEventListener(
    "click",
    nextSong
);


/* =========================================================
   PRÉCÉDENT
========================================================= */

function previousSong() {

    if (songs.length === 0) return;


    if (audio.currentTime > 3) {

        audio.currentTime = 0;

        return;

    }


    let previousIndex =
        currentSong - 1;


    if (previousIndex < 0) {

        previousIndex =
            songs.length - 1;

    }


    playSong(previousIndex);

}


previous.addEventListener(
    "click",
    previousSong
);

miniPrevious.addEventListener(
    "click",
    previousSong
);


/* =========================================================
   FIN DU MORCEAU
========================================================= */

audio.addEventListener(
    "ended",
    () => {

        if (repeatEnabled) {

            audio.currentTime = 0;

            audio.play();

            return;

        }


        nextSong();

    }
);


/* =========================================================
   ALÉATOIRE
========================================================= */

shuffle.addEventListener(
    "click",
    () => {

        shuffleEnabled =
            !shuffleEnabled;


        shuffle.style.opacity =
            shuffleEnabled
                ? "1"
                : "0.55";

    }
);


/* =========================================================
   RÉPÉTITION
========================================================= */

repeat.addEventListener(
    "click",
    () => {

        repeatEnabled =
            !repeatEnabled;


        repeat.style.opacity =
            repeatEnabled
                ? "1"
                : "0.55";

    }
);


/* =========================================================
   PROGRESSION
========================================================= */

audio.addEventListener(
    "loadedmetadata",
    () => {

        duration.textContent =
            formatTime(
                audio.duration
            );

    }
);


audio.addEventListener(
    "timeupdate",
    () => {

        if (!audio.duration) return;


        const percentage =
            (
                audio.currentTime /
                audio.duration
            ) * 100;


        progress.value =
            percentage;


        miniProgress.style.width =
            `${percentage}%`;


        currentTime.textContent =
            formatTime(
                audio.currentTime
            );

    }
);


progress.addEventListener(
    "input",
    () => {

        if (!audio.duration) return;


        audio.currentTime =
            (
                progress.value / 100
            ) * audio.duration;

    }
);


/* =========================================================
   RECHERCHE
========================================================= */

search.addEventListener(
    "input",
    renderLibrary
);


/* =========================================================
   FILTRES
========================================================= */

document
    .querySelectorAll(".filter")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                document
                    .querySelectorAll(".filter")
                    .forEach(item => {

                        item.classList.remove(
                            "active"
                        );

                    });


                button.classList.add(
                    "active"
                );


                currentFilter =
                    button.dataset.filter;


                renderLibrary();

            }
        );

    });


/* =========================================================
   GRAND PLAYER
========================================================= */

openPlayer.addEventListener(
    "click",
    () => {

        if (currentSong === -1) return;

        playerScreen.classList.add(
            "open"
        );

    }
);


closePlayer.addEventListener(
    "click",
    () => {

        playerScreen.classList.remove(
            "open"
        );

    }
);


/* =========================================================
   FAVORI DANS GRAND PLAYER
========================================================= */

playerFavorite.addEventListener(
    "click",
    () => {

        if (currentSong === -1) return;

        toggleFavorite(currentSong);

    }
);


/* =========================================================
   MEDIA SESSION
   Contrôles écran verrouillé / AirPods
========================================================= */

if ("mediaSession" in navigator) {

    audio.addEventListener(
        "play",
        () => {

            navigator.mediaSession.playbackState =
                "playing";

        }
    );


    audio.addEventListener(
        "pause",
        () => {

            navigator.mediaSession.playbackState =
                "paused";

        }
    );

}


function updateMediaSession() {

    if (
        !("mediaSession" in navigator) ||
        currentSong === -1
    ) {

        return;

    }


    const song =
        songs[currentSong];


    const artwork =
        song.artwork;


    const artworkList =
        artwork
            ? [
                {
                    src: artwork,
                    sizes: "512x512",
                    type: "image/jpeg"
                }
            ]
            : [];


    navigator.mediaSession.metadata =
        new MediaMetadata({

            title: song.title,

            artist: song.artist,

            album: song.album,

            artwork: artworkList

        });


    navigator.mediaSession.setActionHandler(
        "play",
        () => audio.play()
    );


    navigator.mediaSession.setActionHandler(
        "pause",
        () => audio.pause()
    );


    navigator.mediaSession.setActionHandler(
        "previoustrack",
        previousSong
    );


    navigator.mediaSession.setActionHandler(
        "nexttrack",
        nextSong
    );

}


/* Mettre à jour Media Session après changement de morceau */

const originalUpdatePlayer =
    updatePlayer;


/* =========================================================
   OUTILS
========================================================= */

function formatTime(seconds) {

    if (
        !seconds ||
        isNaN(seconds)
    ) {

        return "0:00";

    }


    const minutes =
        Math.floor(
            seconds / 60
        );


    const secondsRemaining =
        Math.floor(
            seconds % 60
        )
        .toString()
        .padStart(2, "0");


    return `${minutes}:${secondsRemaining}`;

}


function removeExtension(filename) {

    return filename
        .replace(
            /\.[^/.]+$/,
            ""
        );

}


function isAudioExtension(filename) {

    return /\.(mp3|m4a|aac|wav|flac|alac)$/i
        .test(filename);

}


function escapeHTML(text) {

    return String(text)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}


/* =========================================================
   CORRECTION MEDIA SESSION
========================================================= */

function refreshMediaSession() {

    updateMediaSession();

}


/* Rafraîchir quand le morceau change */

const observer =
    new MutationObserver(
        refreshMediaSession
    );


observer.observe(
    miniTitle,
    {
        childList: true
    }
);