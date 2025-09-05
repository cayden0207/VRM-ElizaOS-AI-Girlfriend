// Character definitions with internationalization support
// Personality and AI features managed by ElizaOS backend
const characters = [
    { id: "alice", name: "Alice", file: "Main VRM/Alice.vrm", voiceId: "rEJAAHKQqr6yTNCh8xS0", descriptionKey: "char.alice.desc" },
    { id: "ash", name: "Ash", file: "Main VRM/Ash.vrm", voiceId: "bY4cOgafbv5vatmokfg0", descriptionKey: "char.ash.desc" },
    { id: "bobo", name: "Bobo", file: "Main VRM/Bobo.vrm", voiceId: "default", descriptionKey: "char.bobo.desc" },
    { id: "elinyaa", name: "Elinyaa", file: "Main VRM/Elinyaa.vrm", voiceId: "4cxHntmhK38NT4QMBr9m", descriptionKey: "char.elinyaa.desc" },
    { id: "fliza", name: "Fliza", file: "Main VRM/Fliza VRM.vrm", voiceId: "s9lrHYk7TIJ2UO7UNbje", descriptionKey: "char.fliza.desc" },
    { id: "imeris", name: "Imeris", file: "Main VRM/IMERIS.vrm", voiceId: "eVItLK1UvXctxuaRV2Oq", descriptionKey: "char.imeris.desc" },
    { id: "kyoko", name: "Kyoko", file: "Main VRM/Kyoko.vrm", voiceId: "ATSlMe1wEISLjgGhZEKK", descriptionKey: "char.kyoko.desc" },
    { id: "lena", name: "Lena", file: "Main VRM/Lena.vrm", voiceId: "uEn2ClE3OziJMlhQS91c", descriptionKey: "char.lena.desc" },
    { id: "lilium", name: "Lilium", file: "Main VRM/Lilium.vrm", voiceId: "yRRXNdbFeQpIK5MAhenr", descriptionKey: "char.lilium.desc" },
    { id: "maple", name: "Maple", file: "Main VRM/Maple.vrm", voiceId: "B8gJV1IhpuegLxdpXFOE", descriptionKey: "char.maple.desc" },
    { id: "miru", name: "Miru", file: "Main VRM/Miru.vrm", voiceId: "eVJCDcwCTZBLNdQdbdmd", descriptionKey: "char.miru.desc" },
    { id: "miumiu", name: "Miumiu", file: "Main VRM/Miumiu.vrm", voiceId: "SU7BtMmgc7KhQiC6G24B", descriptionKey: "char.miumiu.desc" },
    { id: "neco", name: "Neco", file: "Main VRM/Neco.vrm", voiceId: "t9ZwnJtpA3lWrJ4W7pAl", descriptionKey: "char.neco.desc" },
    { id: "nekona", name: "Nekona", file: "Main VRM/NEKONA.vrm", voiceId: "kcg1KQQGuCGzH6FUjsZQ", descriptionKey: "char.nekona.desc" },
    { id: "notia", name: "Notia", file: "Main VRM/Notia.vrm", voiceId: "abz2RylgxmJx76xNpaj1", descriptionKey: "char.notia.desc" },
    { id: "ququ", name: "QuQu", file: "Main VRM/QuQu.vrm", voiceId: "tfQFvzjodQp63340jz2r", descriptionKey: "char.ququ.desc" },
    { id: "rainy", name: "Rainy", file: "Main VRM/Rainy.vrm", voiceId: "1ghrzLZQ7Dza7Xs9OkhY", descriptionKey: "char.rainy.desc" },
    { id: "rindo", name: "Rindo", file: "Main VRM/RINDO.vrm", voiceId: "nclQ39ewSlJMu5Nidnsf", descriptionKey: "char.rindo.desc" },
    { id: "sikirei", name: "Sikirei", file: "Main VRM/Sikirei.vrm", voiceId: "n263mAk9k8VWEuZSmuMl", descriptionKey: "char.sikirei.desc" },
    { id: "vivi", name: "Vivi", file: "Main VRM/Vivi.vrm", voiceId: "4lWJNy00PxQAOMgQTiIS", descriptionKey: "char.vivi.desc" },
    { id: "wolf", name: "Wolf", file: "Main VRM/Wolf.vrm", voiceId: "WW3EvqkXGmu65ga8TYqa", descriptionKey: "char.wolf.desc" },
    { id: "wolferia", name: "Wolferia", file: "Main VRM/Wolferia.vrm", voiceId: "3SeVwPUl5aO6J2GETjox", descriptionKey: "char.wolferia.desc" },
    { id: "yawl", name: "Yawl", file: "Main VRM/Yawl.vrm", voiceId: "c6wjO0u66VyvwAC4UTqx", descriptionKey: "char.yawl.desc" },
    { id: "yuuyii", name: "Yuuyii", file: "Main VRM/Yuuyii.vrm", voiceId: "UPwKM85l2CG7nbF2u1or", descriptionKey: "char.yuuyii.desc" },
    { id: "zwei", name: "Zwei", file: "Main VRM/Zwei.vrm", voiceId: "0EzDWfDZDlAIeQQOjhoC", descriptionKey: "char.zwei.desc" }
];

// Function to get character description using i18n
function getCharacterDescription(character) {
    if (window.i18n && character.descriptionKey) {
        return window.i18n.t(character.descriptionKey);
    }
    // Fallback to English description if i18n is not available
    const fallbackDescriptions = {
        "alice": "Lively and cute AI girlfriend",
        "ash": "Calm and rational AI companion",
        "bobo": "Gentle and sensitive AI girl",
        "elinyaa": "Mysterious and elegant elf",
        "fliza": "Warm and caring farm girl",
        "imeris": "Noble and elegant aristocrat",
        "kyoko": "Independent and confident modern woman",
        "lena": "Elegant and charming designer",
        "lilium": "Passionate and bold dancer",
        "maple": "Warm and healing homebody",
        "miru": "Dreamy and cute girl",
        "miumiu": "Quirky creative artist",
        "neco": "Cool and elegant photographer",
        "nekona": "Mysterious and lazy cat girl",
        "notia": "Intellectual and calm researcher",
        "ququ": "Lively and passionate adventurer",
        "rainy": "Quiet and introverted literary girl",
        "rindo": "Resolute and determined warrior",
        "sikirei": "Mysterious and charming astrologer",
        "vivi": "Cheerful and outgoing streamer",
        "wolf": "Wild and instinctive primitive girl",
        "wolferia": "Free-spirited wolf clan adventurer",
        "yawl": "Elegant and intellectual scholar",
        "yuuyii": "Sweet and lovely girl",
        "zwei": "Steadfast and loyal guardian"
    };
    return fallbackDescriptions[character.id] || "AI Character";
}