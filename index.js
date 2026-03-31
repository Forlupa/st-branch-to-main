// Объявляем глобальные переменные SillyTavern для линтера и корректной работы
/* global characters, this_chid, chat_metadata, toastr, Swal, jQuery */

const extensionName = 'branch-to-main';

/**
 * Получает список всех файлов чатов для текущего персонажа
 */
async function getCharacterChats() {
    try {
        // Проверяем, выбран ли персонаж
        if (typeof this_chid === 'undefined' || this_chid === null) return {};

        const charName = characters[this_chid].name;
        const response = await fetch('/api/chats/get', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ch_name: charName })
        });
        
        if (!response.ok) throw new Error('Ошибка API при получении чатов');
        return await response.json();
    } catch (error) {
        console.error(`[${extensionName}]`, error);
        return {};
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

/* global characters, this_chid, chat_metadata, toastr, Swal, jQuery */

async function openBranchSelector() {
    console.log("[branch-to-main] Открытие окна выбора веток...");

    // ПРОВЕРКА 1: Выбран ли персонаж?
    if (typeof this_chid === 'undefined' || this_chid === null) {
        toastr.warning('Сначала выберите персонажа!');
        return;
    }

    // ПРОВЕРКА 2: Загружены ли метаданные чата?
    // Используем проверку через typeof, чтобы не было ReferenceError
    if (typeof chat_metadata === 'undefined' || !chat_metadata || !chat_metadata.file_name) {
        toastr.error('Данные текущего чата не найдены. Попробуйте отправить сообщение или переоткрыть чат.');
        return;
    }

    const chatsData = await getCharacterChats();
    const chatFiles = Object.keys(chatsData);
    
    // Теперь мы уверены, что chat_metadata существует
    const currentChat = chat_metadata.file_name; 

    // Фильтруем список, чтобы не показывать текущий основной чат в списке веток
    const availableBranches = chatFiles.filter(file => file !== currentChat);

    if (availableBranches.length === 0) {
        toastr.info('У этого персонажа нет других веток или файлов чата.');
        return;
    }

    let optionsHtml = '';
    availableBranches.forEach(branch => {
        const displayName = branch.replace('.jsonl', '');
        optionsHtml += `<option value="${branch}">${displayName}</option>`;
    });

    const { isConfirmed, value: selectedBranch } = await Swal.fire({
        title: 'Выбрать основную ветку',
        html: `
            <div style="text-align:left; font-size: 0.9em;">
                <p>Текущий файл: <b>${currentChat.replace('.jsonl', '')}</b></p>
                <p>Выберите ветку, которая <b>заменит</b> текущий чат:</p>
                <select id="branch-select" class="swal2-select" style="display:flex; width:100%; margin-top: 10px;">
                    ${optionsHtml}
                </select>
                <p style="color: #ff5555; margin-top: 10px;"><b>Внимание:</b> Содержимое основного чата будет полностью перезаписано!</p>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Заменить',
        cancelButtonText: 'Отмена',
        preConfirm: () => document.getElementById('branch-select').value
    });

    if (isConfirmed && selectedBranch) {
        await makeBranchMain(currentChat, selectedBranch);
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