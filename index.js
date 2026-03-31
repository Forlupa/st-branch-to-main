// Объявляем глобальные переменные SillyTavern для линтера и корректной работы
/* global characters, this_chid, chat_metadata, toastr, Swal, jQuery */

const extensionName = 'branch-to-main';

/* global characters, this_chid, chat_metadata, toastr, Swal, jQuery */

/**
 * Пытается найти имя текущего персонажа всеми доступными способами
 */
function getActiveCharacterName() {
    // Способ 1: Из метаданных текущего открытого чата (самый надежный)
    if (typeof chat_metadata !== 'undefined' && chat_metadata && chat_metadata.character_item) {
        return chat_metadata.character_item;
    }

    // Способ 2: Через глобальный индекс текущего персонажа
    if (typeof this_chid !== 'undefined' && this_chid !== null && characters && characters[this_chid]) {
        return characters[this_chid].name;
    }

    // Способ 3: Если это мобильная версия или специфический билд, пробуем window
    if (typeof window.this_chid !== 'undefined' && window.this_chid !== null && window.characters[window.this_chid]) {
        return window.characters[window.this_chid].name;
    }

    return null;
}

async function getCharacterChats() {
    try {
        const charName = getActiveCharacterName();
        if (!charName) {
            console.error("[branch-to-main] Не удалось определить имя персонажа.");
            return {};
        }

        const response = await fetch('/api/chats/get', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ch_name: charName })
        });
        
        if (!response.ok) throw new Error('Ошибка API');
        return await response.json();
    } catch (error) {
        console.error(`[${extensionName}]`, error);
        return {};
    }
}

async function openBranchSelector() {
    console.log("[branch-to-main] Проверка состояния перед открытием...");

    const charName = getActiveCharacterName();
    
    if (!charName) {
        toastr.warning('Персонаж не определен. Попробуйте переоткрыть чат или отправить сообщение.');
        console.log("Debug Info:", { 
            this_chid: typeof this_chid !== 'undefined' ? this_chid : 'undefined', 
            chat_metadata: typeof chat_metadata !== 'undefined' ? chat_metadata : 'undefined' 
        });
        return;
    }

    const chatsData = await getCharacterChats();
    const chatFiles = Object.keys(chatsData);
    
    // Проверка наличия метаданных файла
    const currentChat = (typeof chat_metadata !== 'undefined' && chat_metadata?.file_name) 
                        ? chat_metadata.file_name 
                        : null;

    if (!currentChat) {
        toastr.error('Файл текущего чата не определен.');
        return;
    }

    const availableBranches = chatFiles.filter(file => file !== currentChat);

    if (availableBranches.length === 0) {
        toastr.info(`Для ${charName} других веток не найдено.`);
        return;
    }

    let optionsHtml = '';
    availableBranches.forEach(branch => {
        const displayName = branch.replace('.jsonl', '');
        optionsHtml += `<option value="${branch}">${displayName}</option>`;
    });

    const { isConfirmed, value: selectedBranch } = await Swal.fire({
        title: 'Сделать ветку основной',
        html: `
            <div style="text-align:left;">
                <p>Персонаж: <b>${charName}</b></p>
                <p>Текущий чат: <i>${currentChat.replace('.jsonl', '')}</i></p>
                <hr>
                <p>Выберите ветку для замены:</p>
                <select id="branch-select" class="swal2-select" style="display:flex; width:100%;">
                    ${optionsHtml}
                </select>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Применить замену',
        preConfirm: () => document.getElementById('branch-select').value
    });

    if (isConfirmed && selectedBranch) {
        await makeBranchMain(currentChat, selectedBranch);
    }
}

/**
 * Основная логика замены основного чата данными из ветки
 */
async function makeBranchMain(mainChatFileName, branchFileName) {
    try {
        const charName = characters[this_chid].name;

        // 1. Получаем содержимое выбранной ветки
        const getBranchRes = await fetch('/api/chats/get', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ch_name: charName,
                file_name: branchFileName
            })
        });
        
        const branchData = await getBranchRes.json();
        
        if (!branchData || !Array.isArray(branchData)) {
            toastr.error('Не удалось загрузить данные ветки.');
            return;
        }

        // 2. Сохраняем эти данные в основной файл чата
        const saveRes = await fetch('/api/chats/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ch_name: charName,
                file_name: mainChatFileName,
                chat: branchData
            })
        });

        if (saveRes.ok) {
            toastr.success('Ветка установлена как основная!');
            // Используем встроенный метод SillyTavern для перезагрузки чата
            // @ts-ignore
            window.location.reload(); 
        } else {
            toastr.error('Ошибка при сохранении.');
        }
    } catch (error) {
        console.error(`[${extensionName}]`, error);
    }
}



async function initExtension() {
    console.log("[branch-to-main] Попытка инициализации интерфейса...");

    const buttonId = 'btn_make_branch_main';
    
    // HTML для кнопки (иконка для верхней панели)
    const topBarButtonHtml = `
        <div id="${buttonId}" class="menu_button fa-solid fa-code-branch" 
             title="Make Branch Main" 
             style="cursor: pointer; display: flex; align-items: center; justify-content: center;">
        </div>
    `;

    // Функция для вставки кнопки
    const injectButton = () => {
        if (document.getElementById(buttonId)) return; // Уже добавлена

        // 1. Пытаемся добавить в верхнюю панель (Extensions Menu Bar)
        const topMenu = document.getElementById('extensionsMenu');
        if (topMenu) {
            $(topMenu).append(topBarButtonHtml);
            console.log("[branch-to-main] Кнопка добавлена в верхнюю панель.");
        }

        // 2. Дополнительно добавляем в выпадающее меню у строки ввода (если оно есть)
        const chatMenu = document.getElementById('extensions_menu');
        if (chatMenu) {
            const listButton = `
                <div id="${buttonId}_list" class="list-group-item menu_button">
                    <i class="fa-solid fa-code-branch"></i>
                    <span>Make Branch Main</span>
                </div>
            `;
            $(chatMenu).append(listButton);
            console.log("[branch-to-main] Пункт добавлен в меню чата.");
        }
    };

    // Запускаем проверку каждые 2 секунды (на случай перерисовки UI Таверной)
    setInterval(injectButton, 2000);

    // Вешаем обработчик событий на документ (делегирование)
    $(document).on('click', `#${buttonId}, #${buttonId}_list`, async () => {
        console.log("[branch-to-main] Клик по кнопке зафиксирован.");
        await openBranchSelector();
    });
}

jQuery(initExtension);