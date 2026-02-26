const fields = [
  "planEstudio",
  "curso",
  "trimestre",
  "grupos",
  "asignaturas"
];

const fieldsAsignaturas = [
  "asignaturaID",
  "asignaturaPlan",
  "asignaturaTrimestre",
  "asignaturaGrupos"
];

var asignaturasGuardadas = [];

var modoBusqueda = "curso"; // curso o asignatura

const isFirefox = typeof browser !== "undefined";

async function setItem(key, value) {
  const obj = {};
  obj[key] = value;
  if(!isFirefox) browser.storage.sync.set(obj);
  browser.storage.local.set(obj);
}

async function getItem(key) {
  if (!isFirefox) {
    const result = await browser.storage.sync.get(key);
    if (result[key] !== undefined) return result[key];
  }
  const localResult = await browser.storage.local.get(key);
  return localResult[key];
}

function loadAsignaturasGuardadas() {
  getItem("asignaturasGuardadas").then((value) => {
    asignaturasGuardadas = value ? JSON.parse(value) : [];
    const listaAsignaturas = document.getElementById("asignaturasGuardadasList");
    if (listaAsignaturas) {
      listaAsignaturas.innerHTML = "";
      asignaturasGuardadas.forEach((asignatura, index) => {
        const item = document.createElement("li");
        item.textContent = `ID: ${asignatura.id}, Plan: ${asignatura.plan}, Periodo: ${asignatura.periodo}, Grupo: ${asignatura.grupo}`;
        
        const eliminarBtn = document.createElement("button");
        eliminarBtn.textContent = "Eliminar";
        eliminarBtn.classList.add("btn-eliminar");
        eliminarBtn.addEventListener("click", () => {
          asignaturasGuardadas.splice(index, 1);
          setItem("asignaturasGuardadas", JSON.stringify(asignaturasGuardadas));
          loadAsignaturasGuardadas();
        });
        
        item.appendChild(eliminarBtn);
        listaAsignaturas.appendChild(item);
      });
    }
  });
}

function checkRepetidos(asignaturaID, asignaturaPlan, asignaturaTrimestre, asignaturaGrupos) {
  return asignaturasGuardadas.some(asignatura => 
    asignatura.id === asignaturaID &&
    asignatura.plan === asignaturaPlan &&
    asignatura.trimestre === asignaturaTrimestre &&
    asignatura.grupos === asignaturaGrupos
  );
} 

function loadForm() {
  for (const key of fields) {
    const input = document.getElementById(key);
    if (input) {
      getItem(key).then((value) => {
        input.value = value || "";
      });
    }
  }
}

async function saveForm() {
  const payload = {};
  for (const key of fields) {
    const input = document.getElementById(key);
    payload[key] = input ? String(input.value).trim() : "";
  }

  for (const key of fields) {
    await setItem(key, payload[key]);
  }
}

if(typeof browser === "undefined") {
    window.browser = chrome;
}

document.addEventListener("DOMContentLoaded", async () => {
  loadForm();
  schemaSelect = document.getElementById("schemaColores");
  const linkSchema = document.getElementById("linkSchema");
  if (schemaSelect && linkSchema) {
    getItem("schemaColores").then((value) => {
      if (value) {
        schemaSelect.value = value;
        linkSchema.href = `${value}.css`;
      }
    });

    schemaSelect.addEventListener("change", () => {
      const value = schemaSelect.value;
      linkSchema.href = `${value}.css`;
      setItem("schemaColores", value);
    });
  }

  for (const key of fields) {
    const input = document.getElementById(key);
    if (input) {
      input.addEventListener("change", saveForm);
      input.addEventListener("input", saveForm);
    }
  }

  const modoButtons = document.querySelectorAll(".selectorModoBtn");
  const modoContenedores = document.querySelectorAll(".modo-contenedor");

  modoButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const modo = button.getAttribute("data-modo");
      modoButtons.forEach((btn) => btn.classList.toggle("active", btn === button));
      modoContenedores.forEach((contenedor) => {
        contenedor.style.display = contenedor.id === `modo-${modo}` ? "block" : "none";
      });
      modoBusqueda = modo;
      await setItem("modoBusqueda", modoBusqueda);
    });
  });

  let savedModo = await getItem("modoBusqueda");
  if (savedModo) {
    modoBusqueda = savedModo;
    const modoButton = document.querySelector(`.selectorModoBtn[data-modo="${modoBusqueda}"]`);
    if (modoButton) {
      modoButton.click();
    }
  }

  const asignaturasSaveButton = document.getElementById("asignaturasSaveButton");
  const asignaturasBorrarTodasButton = document.getElementById("btnEliminarTodas");
  const asignaturasGestionarButton = document.getElementById("asignaturasGestionarButton");
  const modalAsignaturas = document.getElementById("modalAsignaturas");
  const btnCerrarModalFooter = document.getElementById("btnCerrarModalFooter");

  if (asignaturasSaveButton) {
    asignaturasSaveButton.addEventListener("click", () => {
      const asignaturaID = document.getElementById("asignaturaID").value.trim();
      const asignaturaPlan = document.getElementById("asignaturaPlan").value.trim();
      const asignaturaTrimestre = document.getElementById("asignaturaTrimestre").value.trim();
      const asignaturaGrupos = document.getElementById("asignaturaGrupos").value.trim();

      if ((asignaturaID !== "" && asignaturaID) && (asignaturaPlan !== "" && asignaturaPlan) &&
          (asignaturaTrimestre !== "" && asignaturaTrimestre) && (asignaturaGrupos !== "" && asignaturaGrupos)) {
        const nuevaAsignatura = {
          id: asignaturaID,
          plan: asignaturaPlan,
          periodo: asignaturaTrimestre,
          grupo: asignaturaGrupos
        };
        if (checkRepetidos(asignaturaID, asignaturaPlan, asignaturaTrimestre, asignaturaGrupos)) {
          alert("Esta asignatura ya está guardada.");
          return;
        }
        asignaturasGuardadas.push(nuevaAsignatura);
        setItem("asignaturasGuardadas", JSON.stringify(asignaturasGuardadas));
      } else {
        alert("Por favor, completa todos los campos de la asignatura antes de guardarla.");
      }
      loadAsignaturasGuardadas();
    });
  }

  if (asignaturasGestionarButton && modalAsignaturas && btnCerrarModalFooter) {
    asignaturasGestionarButton.addEventListener("click", () => {
      modalAsignaturas.style.display = "block";
    });
    
    btnCerrarModalFooter.addEventListener("click", () => {
      modalAsignaturas.style.display = "none";
    });
  }

  if (asignaturasBorrarTodasButton) {
    asignaturasBorrarTodasButton.addEventListener("click", () => {
      if (confirm("¿Estás seguro de que quieres eliminar todas las asignaturas guardadas?")) {
        asignaturasGuardadas = [];
        setItem("asignaturasGuardadas", JSON.stringify(asignaturasGuardadas));
        loadAsignaturasGuardadas();
      }
    });
  }

  loadAsignaturasGuardadas();

  const checkActividad = document.getElementById("checkActividad");

  if (checkActividad) {
    getItem("actividad")?.then((value) => {
      checkActividad.checked = value === "true";
    });
  
    checkActividad.addEventListener("change", () => {
      setItem("actividad", checkActividad.checked ? "true" : "false");
    });
  }
});
