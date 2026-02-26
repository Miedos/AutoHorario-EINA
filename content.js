let pasos = ["Centro", "Plan de estudio", "Curso", "Trimestre", "Grupos" , "Asignaturas", "Resultado"];
let nombres = ["centro", "planEstudio", "curso", "trimestre", "grupos", "asignaturas"];
const pasosAsignaturas = ["Select", "Asignaturas", "Resultado"]
const FSMAsignaturas = ["plan", "periodo", "grupo"];
let pasoActual = parseInt(sessionStorage.getItem("pasoActual")) || 0;
let gestionError = sessionStorage.getItem("gestionError") === "true" ? true : false;
console.log("SCRIPT CARGADO - sessionStorage pasoActual:", sessionStorage.getItem("pasoActual"), "parsed:", pasoActual);
//const gruposSelecionados = [432];
//const asignaturasSelecionadas = [30250, 30237, 30235, 30226, 30236];
const trimestreJSON = {
    "1": "S/1",
    "2": "S/2",
    "*": "-2/-2"
}
var data = {
    centro: "",
    planEstudio: "",
    curso: "",
    trimestre: "",
    grupos: "",
    asignaturas: ""
};

const interfazDataAsignaturas = {
    0: "id",
    1: "plan",
    2: "periodo",
    3: "grupo"
}

// Cada asignatura: { id: "30250", plan: "439", periodo: "S/2", grupo: "432" }
var dataAsignaturas = [];

isFirefox = typeof browser !== "undefined";

async function getSettings() {

    for(const key of nombres) {
        if (!isFirefox) {
            const value = await browser.storage.sync.get(key);
            if (value[key] !== undefined) {
                data[key] = value[key];
                continue;
            }
        }
        const localValue = await browser.storage.local.get(key);
        data[key] = localValue[key] || "";
    }
}

async function getSettingsAsignaturas() {

    try {
        let raw;
        if (!isFirefox) {
            const value = await browser.storage.sync.get("asignaturasGuardadas");
            raw = value["asignaturasGuardadas"];
        }
        if (raw === undefined) {
            const localValue = await browser.storage.local.get("asignaturasGuardadas");
            raw = localValue["asignaturasGuardadas"];
        }
        dataAsignaturas = raw ? JSON.parse(raw) : [];
        for(const asignatura of dataAsignaturas) {
            if(asignatura.grupo === ""){
                asignatura.grupo = -1;
            }
            asignatura.centro = "110"; // El centro es fijo para todas las asignaturas, no se guarda en la extensión porque no aporta nada
            asignatura.periodo = trimestreJSON[asignatura.periodo];
            console.log("Asignatura cargada: ", asignatura);
        }
    } catch (error) {
        console.error("Error al cargar asignaturasData: ", error);
        dataAsignaturas = [];
    }
}

async function waitForElement(selector) {
    return new Promise((resolve) => {
        const element = document.querySelector(selector);
        if (element) {
            resolve(element);
            return;
        }
        const observer = new MutationObserver(() => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });
}

async function waitForSelecDoc(selector,documento = document) {
    return new Promise((resolve) => {
        const element = documento.querySelector(selector);
        if (element && element.style.display !== "none" && element.style.display !== "") {
            resolve(element);
            return;
        }
        const observer = new MutationObserver(() => {
            const element = documento.querySelector(selector);
            if (element && element.style.display !== "none" && element.style.display !== "") {
                resolve(element);
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });
}

async function waitForModalLoad(){
    return new Promise((resolve) => {
        if (!document.body.classList.contains("modal-open")) {
            console.log("No hay modal abierto, continuando...");
            resolve();
            return;
        }
        const observer = new MutationObserver(() => {
            if (!document.body.classList.contains("modal-open")) {
                console.log("Modal cerrado, continuando...");
                observer.disconnect();
                resolve();
            }
        });
        observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    });
}

async function waitForModalFadeOut(selector) {
    return new Promise((resolve) => {
        const element = document.querySelector(selector);
        if (element && !element.classList.contains("in")) {
            resolve();
            return;
        }
        const observer = new MutationObserver(() => {
            const element = document.querySelector(selector);
            if (element && !element.classList.contains("in")) {
                observer.disconnect();
                resolve();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });
}

async function waitForModalBackdropGone(timeout = 3000) {
    return new Promise((resolve) => {
        const checkBackdrop = () => Array.from(document.body.children).some(child => 
            child.classList.contains("modal-backdrop") && 
            child.classList.contains("fade") && 
            child.classList.contains("in")
        );

        if (!checkBackdrop()) {
            console.log("No hay modal-backdrop, continuando...");
            resolve();
            return;
        }

        console.log("Esperando a que desaparezca el modal-backdrop...");

        const timer = setTimeout(() => {
            console.warn("Timeout esperando modal-backdrop, forzando continuación...");
            observer.disconnect();
            resolve();
        }, timeout);

        const observer = new MutationObserver(() => {
            if (!checkBackdrop()) {
                console.log("Modal-backdrop desapareció, continuando...");
                clearTimeout(timer);
                observer.disconnect();
                resolve();
            }
        });

        // subtree:true para detectar cambios de clase en el propio backdrop, no solo en body
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    });
}

async function parsearDatos() {
    try {
        if (["", " ", "*"].includes(data.grupos.trim())) {
            data.grupos = [];
        } else {
            data.grupos = data.grupos.split(",").map(s => s.trim()).filter(s => s !== "");
        }
    } catch (error) {
        console.error("Error al parsear grupos: ", error);
        data.grupos = [];
    }
    try {
        if (["", " ", "*"].includes(data.asignaturas.trim())) {
            data.asignaturas = [];
        } else {
            data.asignaturas = data.asignaturas.split(",").map(s => s.trim()).filter(s => s !== "");
        }
    } catch (error) {
        console.error("Error al parsear asignaturas: ", error);
        data.asignaturas = [];
    }
}

async function autofill() {
    console.log("Checking URL for autofill...");
    console.log("Current URL: " + document.URL);
    if(document.URL.split("?")[0].includes("look[conpub]MostrarPubHora")) {
        sessionStorage.removeItem("pasoActual");
        sessionStorage.removeItem("gestionError");
        console.log("Disfruta del calendario :)");
        return; 
    }
    if(gestionError === "true") {
        alert(`Ha ocurrido un error grave al generar el horario. Por favor, REVISA LOS DATOS GUARDADOS EN LA EXTENSIÓN, SI ES CORRECTA, CONTACTA CONMIGO (El creador Daniel Gallán Soro (Tendras que seguir la cadena de gente que te ha ido pasando esta extensión para llegar hasta mi (Buena suerte))) Y TOMA UNA FOTO DE TUS DATOS GUARDADOS EN LA EXTENSIÓN Y DE LOS ERRORES QUE APARECEN EN LA CONSOLA (Pulsa F12 para abrir la consola)`);
        return;
    }
    if(pasos[pasoActual] === "Centro") {
        const centro = await waitForElement('#centro');
        console.log("Autofilling centro...");
        if (centro) {
            centro.value = "110"
            console.log("Centro set to 110");
            pasoActual++;
            sessionStorage.setItem("pasoActual", pasoActual);
            centro.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            console.log("Elemento 'centro' no encontrado.");
        }
        return;
    } if (pasos[pasoActual] === "Plan de estudio") {
        const planEstudio = await waitForElement('#planEstudio');
        console.log("Autofilling plan de estudio...");
        if (planEstudio) {
            planEstudio.value = data.planEstudio ? data.planEstudio : "439";
            console.log("Plan de estudio set to 439");
            pasoActual++;
            sessionStorage.setItem("pasoActual", pasoActual);
            planEstudio.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            console.log("Elemento 'planEstudio' no encontrado.");
        }
        return;
    } if (pasos[pasoActual] === "Curso") {
        const curso = await waitForElement('#curso');
        console.log("Autofilling curso...");
        if (curso) {
            curso.value = data.curso ? data.curso : "3";
            console.log("Curso set to" + data.curso);
            pasoActual++;
            sessionStorage.setItem("pasoActual", pasoActual);
            curso.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            console.log("Elemento 'curso' no encontrado.");
        }
        return;
    } if (pasos[pasoActual] === "Trimestre") {
        const trimestre = await waitForElement('#trimestre');
        console.log("Autofilling trimestre...");
        if (trimestre) {
            trimestre.value = data.trimestre ? trimestreJSON[data.trimestre]: "S/2";
            console.log("Trimestre set to " + trimestreJSON[data.trimestre]);
            pasoActual++;
            sessionStorage.setItem("pasoActual", pasoActual);
            trimestre.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            console.log("Elemento 'trimestre' no encontrado.");
        }
        return;
    } if (pasos[pasoActual] === "Grupos") {
        const grupos = await waitForElement('#grupos');
        console.log("Autofilling grupos...");
        const selectGrupos = document.getElementById("grupos");
        const container = selectGrupos.parentElement;
        const button = container.querySelector(".ui-multiselect");
        console.log(grupos);
        console.log(selectGrupos);
        console.log(container);
        console.log(button);
        button.click();
        const menuAbierto = await waitForElement('.ui-multiselect-menu[style*="display: block"]');
        const cajas = menuAbierto.querySelector('.ui-multiselect-checkboxes');
        const opciones = cajas.querySelectorAll("li");
        console.log(menuAbierto);
        console.log(opciones);  
        if(data.grupos.length > 0) {
            const gruposArray = data.grupos;
            opciones.forEach(opcion => {
            entrada = opcion.querySelector("input[name='multiselect_grupos']");
            console.log(entrada);
            if(!gruposArray.includes(entrada.value)) {
                entrada.click();
                console.log("Deseleccionando grupo: " + entrada.value);
            }
        });
            button.click();
            console.log(menuAbierto);
            pasoActual++;
            sessionStorage.setItem("pasoActual", pasoActual);
        return;
        } else {
            console.log("Seleccionando todos los grupos");
            button.click();
            pasoActual++;
            sessionStorage.setItem("pasoActual", pasoActual);
        }
    } if (pasos[pasoActual] === "Asignaturas") {
        console.log("Autofilling asignaturas...");
        const selectAsignaturas = document.getElementById("asignaturas");
        const container = selectAsignaturas.parentElement;
        const button = container.querySelector(".ui-multiselect");
        button.click();
        const menuAbierto = await waitForElement('.ui-multiselect-menu[style*="display: block"]');
        const cajas = menuAbierto.querySelector('.ui-multiselect-checkboxes');
        const opciones = cajas.querySelectorAll("li");
        console.log(menuAbierto);
        console.log(opciones);
        if(data.asignaturas.length > 0) {
            const asignaturasArray = data.asignaturas;
            opciones.forEach(opcion => {
            entrada = opcion.querySelector("input[name='multiselect_asignaturas']");
            console.log(entrada);
            if(!asignaturasArray.includes(entrada.value)) {
                entrada.click();
                console.log("Deseleccionando asignatura: " + entrada.value);
            }

        });
            button.click();
            console.log(menuAbierto);
            pasoActual++;
            sessionStorage.setItem("pasoActual", pasoActual);
            return;
        } else {
            console.log("Seleccionando todas las asignaturas");
            button.click();
            pasoActual++;
            sessionStorage.setItem("pasoActual", pasoActual);
        }
    } if (pasos[pasoActual] === "Resultado") {
        console.log("Autofill complete!");
        sessionStorage.removeItem("pasoActual");
        const generarHorario = document.querySelector("#buscarCalendario");
        gestionError = true;
        sessionStorage.setItem("gestionError", gestionError);
        generarHorario.click();
    } if(pasos[pasoActual] === undefined || pasos[pasoActual] === null || !pasos[pasoActual].includes(pasos)) {
        console.log("Paso actual no reconocido: " + pasos[pasoActual]);
    }
}

async function autofillAsignaturas() {

    console.log("Checking URL for autofill...");
    console.log("Current URL: " + document.URL);
    console.log("Paso actual: " + pasosAsignaturas[pasoActual] + " (" + pasoActual + ")");
    if(document.URL.split("?")[0].includes("look[conpub]MostrarPubHora")) {
        sessionStorage.removeItem("pasoActual");
        sessionStorage.removeItem("gestionError");
        console.log("Disfruta del calendario :)");
        return; 
    }
    if(gestionError === "true") {
        alert(`Ha ocurrido un error grave al generar el horario. Por favor, REVISA LOS DATOS GUARDADOS EN LA EXTENSIÓN, SI ES CORRECTA, CONTACTA CONMIGO (El creador Daniel Gallán Soro (Tendras que seguir la cadena de gente que te ha ido pasando esta extensión para llegar hasta mi (Buena suerte))) Y TOMA UNA FOTO DE TUS DATOS GUARDADOS EN LA EXTENSIÓN Y DE LOS ERRORES QUE APARECEN EN LA CONSOLA (Pulsa F12 para abrir la consola)`);
        return;
    }

    if(pasosAsignaturas[pasoActual] === "Select") {

        const pestanaAsignaturas = document.querySelector("#tabAsignatura");
        console.log(pestanaAsignaturas);
        const botonAsignaturas = pestanaAsignaturas.querySelector("a");
        console.log(botonAsignaturas);
        if(pestanaAsignaturas) {
            pasoActual++;
            sessionStorage.setItem("pasoActual", pasoActual);
            botonAsignaturas.click();
        } else {
            console.log("Pestaña de asignaturas no encontrada");
        }
        return;
    }

    if(pasosAsignaturas[pasoActual] === "Asignaturas") {
        console.log("Autofilling asignaturas...");
        const formu_Edi_Asignatura = document.querySelector("#formu_Edi_Asignatura");

        if(!formu_Edi_Asignatura) {
            console.log("Formulario de asignaturas no encontrado");
            return;
        }

        const bootstrap_tagsinput = formu_Edi_Asignatura.querySelector(".bootstrap-tagsinput");
        if (!bootstrap_tagsinput) {
            console.log("Bootstrap tagsinput no encontrado");
            return;
        }

        // Limpiar el input antes de agregar las asignaturas
        const inputAsignaturas = bootstrap_tagsinput.querySelector("input");

        // Agregar cada asignatura al input
        for(const asignatura of dataAsignaturas) {
            inputAsignaturas.focus();
            inputAsignaturas.value = asignatura.id;

            console.log("Agregando asignatura: " + asignatura.id);
            console.log(inputAsignaturas);

            // Disparar eventos de teclado correctamente (KeyboardEvent, no Event genérico)
            for (const eventType of ['keydown', 'keypress', 'keyup']) {
                inputAsignaturas.dispatchEvent(new KeyboardEvent(eventType, { bubbles: true, cancelable: true }));
            }
            inputAsignaturas.dispatchEvent(new Event('input', { bubbles: true }));
            inputAsignaturas.dispatchEvent(new Event('change', { bubbles: true }));

            // Esperar el delay del typeahead antes de buscarlo
            // await new Promise(r => setTimeout(r, 500));

            const typeahead = await waitForSelecDoc(".typeahead", bootstrap_tagsinput);

            if (!typeahead) {
                console.log("Typeahead no encontrado o no se hizo visible a tiempo");
                console.log("Estado del bootstrap-tagsinput:", bootstrap_tagsinput.innerHTML);
                return;
            }

            console.log("Typeahead visible:", typeahead);

            // Buscar la opción correcta por ID con reintentos (en dispositivos lentos el typeahead puede no estar listo)
            let option = null;
            const maxIntentos = 10;
            for (let intento = 0; intento < maxIntentos; intento++) {
                const items = typeahead.querySelectorAll("li");
                for (const item of items) {
                    const strong = item.querySelector("a strong");
                    if (strong && strong.textContent.trim() === String(asignatura.id)) {
                        option = item.querySelector("a");
                        break;
                    }
                }
                if (option) break;
                console.log(`Intento ${intento + 1}/${maxIntentos}: opción con ID "${asignatura.id}" no encontrada aún, esperando...`);
                await new Promise(r => setTimeout(r, 300));
            }

            console.log(option);

            if (!option) {
                console.log(`Opción de asignatura no encontrada tras ${maxIntentos} intentos para: ` + asignatura.id);
                return;
            }

            option.click();
            inputAsignaturas.blur(); // Quitar el focus inmediatamente para cerrar el typeahead
            await waitForModalLoad();
            console.log("Asignatura seleccionada: " + asignatura.id);

            const filtreAsig = await waitForElement("#filtreAsig");

            if(!filtreAsig) {
                console.log("Filtro de asignaturas no encontrado");
                return;
            }

            const modal_body = filtreAsig.querySelector(".modal-body");

            console.log("Modal body encontrado:", modal_body);

            if(!modal_body) {
                console.log("Modal body no encontrado");
                return;
            }

            console.log("=== ESTADO DEL MODAL-BODY (Formateado) ===");
            console.log(modal_body.outerHTML); // Incluye el elemento completo
            console.log("==========================================");

            const opciones = modal_body.querySelectorAll(".col-md-12.form-group[style*='display: block']");

            console.log("Opciones visibles encontradas:", opciones);

            if(opciones.length === 0) {
                console.log("No se encontraron opciones visibles para la asignatura seleccionada");
                return;
            }

            console.log("Opciones encontradas para la asignatura:", opciones);

            for(const opcion of opciones) {
                while(true){
                const selectEl = opcion.querySelector("select");
                if (!selectEl) {
                    console.log("Elemento select no encontrado en la opción:", opcion);
                    if(opcion.querySelector("#filtroYaSeleccionado")) {
                        console.log(`Esta opcion siempre aparece por que el div es visible pero el texto no, 
                            asumimos que el usuario no puso repetidas gracias a la config del frontend`);
                            break;
                    }
                    continue;
                }

                const campo = selectEl.id; // "centro", "plan", "periodo", "grupo"
                console.log(`Campo encontrado: ${campo}, disabled: ${selectEl.disabled}`);
                console.log(`Select element:`, selectEl);

                const valor = asignatura[campo];
                if (valor !== undefined && valor !== null && valor !== "") {
                    if(selectEl.value === valor) {
                        console.log(`Campo ${campo} ya tiene el valor correcto: ${valor}`);
                        break;
                    } else if (!selectEl.disabled) {
                        selectEl.value = valor;
                        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
                        console.log(`Campo ${campo} establecido a: ${valor}`);
                        break;
                    } else {
                        console.log(`Campo ${campo} está deshabilitado, no se puede establecer a: ${valor}, posible error o no`);
                        await new Promise(r => setTimeout(r, 1000)); // Esperar un poco antes de continuar para ver si se habilita o si es un error real
                    }
                    
                } else {
                    console.log(`No hay valor en la asignatura para el campo: ${campo}`);
                }
                }
            }

            const filtroYaSeleccionado = modal_body.querySelector("#filtroYaSeleccionado[style*='display: block']");
            if (filtroYaSeleccionado) {
                console.log("Filtro ya seleccionado encontrado");
                const botonCerrar = filtreAsig.querySelector(".modal-footer #cancelarFiltro");
                if (botonCerrar) {
                    botonCerrar.click();
                    await waitForModalLoad();
                    console.log("Cerrando modal de asignatura ya seleccionada");
                } else {
                    console.log("Botón para cerrar modal de asignatura ya seleccionada no encontrado");
                }
            } else {
                console.log("No se encontró el filtro de asignatura ya seleccionada, continuando con el proceso normal");
                const botonAceptar = filtreAsig.querySelector(".modal-footer #aceptarFiltro");
                if (botonAceptar) {
                    botonAceptar.click();
                    // Esperar a que el modal cierre O a que filtroYaSeleccionado aparezca (backend lento)
                    await new Promise(resolve => {
                        const observer = new MutationObserver(() => {
                            const yaSeleccionadoTardio = modal_body.querySelector("#filtroYaSeleccionado[style*='display: block']");
                            if (yaSeleccionadoTardio) {
                                console.log("filtroYaSeleccionado apareció tras aceptar (backend lento), cerrando modal...");
                                observer.disconnect();
                                const botonCerrar = filtreAsig.querySelector(".modal-footer #cancelarFiltro");
                                if (botonCerrar) {
                                    botonCerrar.click();
                                }
                                waitForModalLoad().then(resolve);
                                return;
                            }
                            if (!document.body.classList.contains("modal-open")) {
                                observer.disconnect();
                                resolve();
                            }
                        });
                        // Check immediato por si ya se cumplió antes de que el observer esté activo
                        if (!document.body.classList.contains("modal-open")) {
                            resolve();
                            return;
                        }
                        observer.observe(document.body, { attributes: true, attributeFilter: ["class"], subtree: true });
                    });
                    console.log("Aceptando selección de asignatura");
                } else {
                    console.log("Botón para aceptar selección de asignatura no encontrado");
                }
            }

            inputAsignaturas.value = ""; // Limpiar el input para la siguiente asignatura
            for (const eventType of ['keydown', 'keypress', 'keyup']) {
                inputAsignaturas.dispatchEvent(new KeyboardEvent(eventType, { bubbles: true, cancelable: true }));
            }
            inputAsignaturas.dispatchEvent(new Event('input', { bubbles: true }));
            inputAsignaturas.dispatchEvent(new Event('change', { bubbles: true }));

            console.log("=== ESTADO DEL MODAL-BODY (Formateado) FINAL BUCLE ===");
            console.log(modal_body.outerHTML); // Incluye el elemento completo
            console.log("==========================================");
            await waitForModalLoad(); // Esperar a que cualquier modal se cierre antes de continuar con la siguiente asignatura
            await waitForModalBackdropGone(); // Asegurarse de que el backdrop del modal haya desaparecido antes de continuar
        }
        pasoActual++;
        sessionStorage.setItem("pasoActual", pasoActual);
    }

    if(pasosAsignaturas[pasoActual] === "Resultado") {
        console.log("Autofill de asignaturas completo, generando horario...");
        const generarHorario = document.querySelector("#buscarCalendario");
        gestionError = true;
        sessionStorage.setItem("gestionError", gestionError);
        generarHorario.click();
    } if(pasosAsignaturas[pasoActual] === undefined || pasosAsignaturas[pasoActual] === null || !pasosAsignaturas[pasoActual].includes(pasosAsignaturas[pasoActual])) {
        console.log("Paso actual no reconocido: " + pasosAsignaturas[pasoActual]);
    }
}

async function inicializar() {
    let modoBusqueda;
    if(!isFirefox) {
    const value = await browser.storage.sync.get("modoBusqueda");
        if(value.modoBusqueda) {
            modoBusqueda = value.modoBusqueda;
        } else {
            const localValue = await browser.storage.local.get("modoBusqueda");
            modoBusqueda = localValue.modoBusqueda || "curso";
        }
    } else {
        const localValue = await browser.storage.local.get("modoBusqueda");
        modoBusqueda = localValue.modoBusqueda || "curso";
    }

    if(modoBusqueda === "curso") {
        await getSettings();
        await parsearDatos();
        await autofill();

    } else if(modoBusqueda === "asignaturas") {
        await getSettingsAsignaturas();
        await autofillAsignaturas();
    }
}

async function checkActivo() {
    let activo;
    if(typeof browser === "undefined") {
        window.browser = chrome;
    }
    if(!isFirefox) {
        const value = await browser.storage.sync.get("actividad");
        if(value.actividad !== undefined) {
            activo = value.actividad;
        } else {
            const localValue = await browser.storage.local.get("actividad");
            activo = localValue.actividad !== undefined ? localValue.actividad : true; // Por defecto activo
        }
    } else {
        const localValue = await browser.storage.local.get("actividad");
        activo = localValue.actividad !== undefined ? localValue.actividad : true; // Por defecto activo
    }
    console.log("Estado de actividad de la extensión:", activo);
    if(activo === "true" || activo === true) {
        console.log("Extensión activa, iniciando autofill...");
        inicializar();
    } else {
        console.log("Extensión inactiva, no se realizará el autofill.");
    }
}

checkActivo();
