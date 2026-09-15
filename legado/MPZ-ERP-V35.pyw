# -*- coding: utf-8 -*-
# MPZ-ERP-V34
# Niveis editaveis - usuario define o nome de cada nivel
# Banco de dados inicia vazio
#
# Correcoes desta versao (ver ANALISE_MELHORIAS.md):
# 1) Bug critico: calculo de estoque nao reconhecia "Entrada fabricacao",
#    "Saida producao" e "Liberacao reserva" por divergencia de acentuacao
#    entre a lista MOVEMENTS e a funcao stock_values().
# 2) ROOT_CODES nunca era populado -> protecao contra exclusao/remocao
#    do item raiz nunca funcionava. Agora a "raiz" e definida pelo Nivel 0
#    (consistente com o sistema de niveis editaveis), nao por um codigo fixo.
# 3) ROOT_CODE fixo ("EQP001") nao correspondia ao codigo real do item raiz
#    cadastrado (ex.: "EQP-001"). Status "OK" e referencia padrao agora usam
#    o(s) item(ns) de Nivel 0 reais do banco.
import csv
from datetime import datetime
from pathlib import Path
import os, re, shutil, sqlite3, sys, tkinter as tk
from tkinter import filedialog, messagebox, ttk
import tkinter.font as tkfont
import traceback, unicodedata, webbrowser

try:
    from PIL import Image, ImageTk
    HAS_PIL = True
except Exception:
    HAS_PIL = False

PROGRAM_DIR = Path(__file__).resolve().parent
DB_PATH = PROGRAM_DIR / "mapzer_minierp.db"
LOG_PATH = PROGRAM_DIR / "error_log.txt"
IMAGES_DIR = PROGRAM_DIR / "images"
IMAGES_DIR.mkdir(exist_ok=True)

ROOT_DESCRIPTION = "Equipamento finalizado"

CLASSIFICATIONS = ["Estrutural", "Carenagem/Domo", "Fixa\u00e7\u00e3o", "El\u00e9trica", "Eletr\u00f4nica/Automa\u00e7\u00e3o", "Sensor", "Cabeamento", "Conex\u00e3o el\u00e9trica", "Mec\u00e2nica fabricada", "Impress\u00e3o 3D", "Consum\u00edvel"]
UNITS = ["un", "kg", "g", "m", "kit", "rolo", "caixa", "conj."]
ACQUISITIONS = ["Compra nacional", "Compra importada", "Fabrica\u00e7\u00e3o interna", "Sob encomenda"]
ORIGINS = ["Interna - Impress\u00e3o 3D", "Interna - Usinagem", "Interna - Montagem", "Terceiro - Impress\u00e3o 3D", "Terceiro - Usinagem", "Terceiro - Corte/Dobra", "Compra pronta nacional", "Compra importada"]
MOVEMENTS = ["Entrada compra", "Entrada fabrica\u00e7\u00e3o", "Sa\u00edda produ\u00e7\u00e3o", "Reserva", "Libera\u00e7\u00e3o reserva", "Ajuste positivo", "Ajuste negativo"]
INITIAL_ENTRIES = ["N\u00e3o adicionar ao estoque", "Entrada compra", "Entrada fabrica\u00e7\u00e3o", "Ajuste positivo"]
FILTERS = ["Todos"] + MOVEMENTS
SUMMARY_FILTERS = ["Todos", "Apenas OK", "Em Falta", "Com Reserva", "Com Prazo / Aguardando"]
MATERIALS_3D = ["ABS", "PLA", "PETG", "TPU", "TPE", "ASA", "Nylon", "PA", "PA6", "PA12", "PA-GF", "PA-CF", "PC", "PC-ABS", "POM", "PP", "HIPS", "PVA", "BVOH", "PET", "PEEK", "PEI", "ULTEM", "Resina standard", "Resina tough", "Resina flex\u00edvel", "Resina lav\u00e1vel em \u00e1gua", "Outro"]
SUPPLIER_STATUSES = ["Preferencial", "Aprovado", "Em avalia\u00e7\u00e3o", "Emerg\u00eancia", "Bloqueado"]

# ---------------------------------------------------------------------------
# TEMA (claro/escuro)
# As cores abaixo sao variaveis de MODULO (nao literais fixos). Cada tela do
# app usa esses nomes em vez do codigo hexadecimal direto, entao alternar
# entre LIGHT_PALETTE e DARK_PALETTE e so atualizar estas variaveis e
# reconstruir a interface (App.rebuild_ui). Cores de botao (azul/verde/
# vermelho/laranja/cinza) permanecem fixas nos dois temas: sao saturadas o
# bastante para ler bem tanto no fundo claro quanto no escuro.
LIGHT_PALETTE = {"BG_APP": "#f1f5f9", "BG_PANEL": "#ffffff", "TEXT": "#0f172a", "TEXT_SOFT": "#334155", "MUTED_TEXT": "#64748b", "TAB_BG": "#e2e8f0", "TAB_FG": "#475569", "ROW_HL": "#dbeafe", "LIST_SEL": "#bae6fd", "ENTRY_BORDER": "#cbd5e1"}
DARK_PALETTE = {"BG_APP": "#0b1220", "BG_PANEL": "#1e293b", "TEXT": "#e2e8f0", "TEXT_SOFT": "#cbd5e1", "MUTED_TEXT": "#94a3b8", "TAB_BG": "#334155", "TAB_FG": "#94a3b8", "ROW_HL": "#1e3a5f", "LIST_SEL": "#1e3a5f", "ENTRY_BORDER": "#334155"}
BG_APP = LIGHT_PALETTE["BG_APP"]
BG_PANEL = LIGHT_PALETTE["BG_PANEL"]
TEXT = LIGHT_PALETTE["TEXT"]
TEXT_SOFT = LIGHT_PALETTE["TEXT_SOFT"]
MUTED_TEXT = LIGHT_PALETTE["MUTED_TEXT"]
TAB_BG = LIGHT_PALETTE["TAB_BG"]
TAB_FG = LIGHT_PALETTE["TAB_FG"]
ROW_HL = LIGHT_PALETTE["ROW_HL"]
LIST_SEL = LIGHT_PALETTE["LIST_SEL"]
ENTRY_BORDER = LIGHT_PALETTE["ENTRY_BORDER"]

def apply_palette(theme):
    """Atualiza as variaveis globais de cor para 'light' ou 'dark'."""
    global BG_APP, BG_PANEL, TEXT, TEXT_SOFT, MUTED_TEXT, TAB_BG, TAB_FG, ROW_HL, LIST_SEL, ENTRY_BORDER
    p = DARK_PALETTE if theme == "dark" else LIGHT_PALETTE
    BG_APP, BG_PANEL, TEXT, TEXT_SOFT, MUTED_TEXT = p["BG_APP"], p["BG_PANEL"], p["TEXT"], p["TEXT_SOFT"], p["MUTED_TEXT"]
    TAB_BG, TAB_FG, ROW_HL, LIST_SEL, ENTRY_BORDER = p["TAB_BG"], p["TAB_FG"], p["ROW_HL"], p["LIST_SEL"], p["ENTRY_BORDER"]

def _shade(hex_color, factor, toward="#ffffff"):
    """Clareia (factor>0) ou escurece um hex misturando com toward/preto."""
    hex_color = hex_color.lstrip("#")
    toward = toward.lstrip("#")
    r1, g1, b1 = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
    r2, g2, b2 = int(toward[0:2], 16), int(toward[2:4], 16), int(toward[4:6], 16)
    r = int(r1 + (r2 - r1) * factor)
    g = int(g1 + (g2 - g1) * factor)
    b = int(b1 + (b2 - b1) * factor)
    return f"#{max(0,min(255,r)):02x}{max(0,min(255,g)):02x}{max(0,min(255,b)):02x}"

class RButton(tk.Canvas):
    """Botao com cantos arredondados desenhado em Canvas (Tkinter puro nao
    suporta 'border-radius'; esta e a forma de simular isso sem depender de
    bibliotecas externas). Mantem a mesma interface basica de tk.Button:
    text, command, bg, fg, font, padx, pady, e aceita .config(text=..., bg=...)
    para os botoes que trocam de estado (ex.: mostrar/ocultar)."""
    def __init__(self, parent, text="", command=None, bg="#0ea5e9", fg="white", font=("Segoe UI", 10, "bold"), padx=14, pady=8, radius=10, state="normal", **kw):
        kw.pop("relief", None)
        try:
            outer_bg = kw.pop("bg_outer", None) or parent.cget("bg")
        except Exception:
            outer_bg = BG_APP
        super().__init__(parent, highlightthickness=0, bd=0, bg=outer_bg, cursor="hand2")
        self._text, self._command = text, command
        self._bg, self._fg, self._font = bg, fg, font
        self._padx, self._pady, self._radius = padx, pady, radius
        self._disabled = (state == "disabled")
        self._hover = False
        self.bind("<Button-1>", self._click)
        self.bind("<Enter>", lambda e: self._set_hover(True))
        self.bind("<Leave>", lambda e: self._set_hover(False))
        self._redraw()

    def _fill(self):
        if self._disabled:
            return _shade(self._bg, 0.55)
        return _shade(self._bg, 0.18) if self._hover else self._bg

    def _redraw(self):
        self.delete("all")
        f = tkfont.Font(font=self._font)
        w = max(f.measure(self._text) + self._padx * 2, 24)
        h = max(f.metrics("linespace") + self._pady * 2, 20)
        self.config(width=w, height=h)
        r = min(self._radius, h // 2, w // 2)
        pts = [1 + r, 1, w - 1 - r, 1, w - 1, 1, w - 1, 1 + r, w - 1, h - 1 - r, w - 1, h - 1, w - 1 - r, h - 1, 1 + r, h - 1, 1, h - 1, 1, h - 1 - r, 1, 1 + r, 1, 1]
        self.create_polygon(pts, smooth=True, fill=self._fill(), outline=self._fill())
        self.create_text(w // 2, h // 2, text=self._text, fill=self._fg, font=self._font)

    def _set_hover(self, val):
        if self._disabled:
            return
        self._hover = val
        self._redraw()

    def _click(self, event=None):
        if not self._disabled and self._command:
            self._command()

    def config(self, cnf=None, **kwargs):
        kwargs.update(cnf or {})
        redraw = False
        for key in ("text", "bg", "fg", "font", "command"):
            if key in kwargs:
                setattr(self, f"_{key}" if key != "command" else "_command", kwargs.pop(key))
                redraw = True
        if "state" in kwargs:
            self._disabled = kwargs.pop("state") == "disabled"
            redraw = True
        if kwargs:
            tk.Canvas.config(self, **kwargs)
        if redraw:
            self._redraw()
    configure = config

def log_error(text):
    try:
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(f"\n{datetime.now().isoformat()}\n{text}\n")
    except Exception:
        pass

def connect():
    con = sqlite3.connect(DB_PATH)
    con.execute("PRAGMA foreign_keys=ON")
    return con

def ensure_column(con, table, name, definition):
    if name not in {r[1] for r in con.execute(f"PRAGMA table_info({table})")}:
        con.execute(f"ALTER TABLE {table} ADD COLUMN {name} {definition}")

def init_db():
    with connect() as con:
        con.execute("CREATE TABLE IF NOT EXISTS items (code TEXT PRIMARY KEY, description TEXT NOT NULL, classification TEXT NOT NULL, unit TEXT NOT NULL, acquisition TEXT, manufacturing_origin TEXT, supplier TEXT, purchase_link TEXT, lead_value REAL DEFAULT 0, lead_unit TEXT DEFAULT 'dias', unit_cost REAL DEFAULT 0, location TEXT, notes TEXT, image_path TEXT, stl_path TEXT, level INTEGER DEFAULT 0, created_at TEXT NOT NULL)")
        for n, d in [("image_path", "TEXT"), ("lead_value", "REAL DEFAULT 0"), ("lead_unit", "TEXT DEFAULT 'dias'"), ("level", "INTEGER DEFAULT 0")]:
            ensure_column(con, "items", n, d)
        con.execute("CREATE TABLE IF NOT EXISTS item_images (id INTEGER PRIMARY KEY AUTOINCREMENT, item_code TEXT NOT NULL, image_path TEXT NOT NULL, sort_order INTEGER DEFAULT 0, created_at TEXT NOT NULL)")
        con.execute("CREATE TABLE IF NOT EXISTS suppliers (id INTEGER PRIMARY KEY AUTOINCREMENT, item_code TEXT NOT NULL, supplier_name TEXT NOT NULL, contact_name TEXT, phone TEXT, email TEXT, website TEXT, supplier_sku TEXT, item_link TEXT, price REAL DEFAULT 0, lead_value REAL DEFAULT 0, lead_unit TEXT DEFAULT 'dias', minimum_qty REAL DEFAULT 0, minimum_unit TEXT, terms TEXT, shipping TEXT, status TEXT, notes TEXT, sort_order INTEGER DEFAULT 0, created_at TEXT NOT NULL)")
        con.execute("CREATE TABLE IF NOT EXISTS bom (id INTEGER PRIMARY KEY AUTOINCREMENT, parent_code TEXT NOT NULL, child_code TEXT NOT NULL, quantity REAL NOT NULL, required TEXT DEFAULT 'SIM', assembly_location TEXT, sort_order INTEGER DEFAULT 0, created_at TEXT NOT NULL)")
        ensure_column(con, "bom", "sort_order", "INTEGER DEFAULT 0")
        con.execute("CREATE TABLE IF NOT EXISTS movements (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, movement_type TEXT NOT NULL, item_code TEXT NOT NULL, quantity REAL NOT NULL, reference TEXT, responsible TEXT, notes TEXT)")
        con.execute("UPDATE bom SET sort_order=id WHERE sort_order IS NULL OR sort_order=0")
        
        # Tabela de configuracoes dos niveis
        con.execute("CREATE TABLE IF NOT EXISTS level_config (id INTEGER PRIMARY KEY, level_num INTEGER UNIQUE, level_name TEXT)")
        # Insere niveis padrao se nao existirem
        for i, name in [(0, "Principal"), (1, "Componente"), (2, "Sub-componente"), (3, "Detalhe")]:
            con.execute("INSERT OR IGNORE INTO level_config(level_num, level_name) VALUES(?,?)", (i, name))

        # Preferencias do app (ex.: tema claro/escuro)
        con.execute("CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT)")

def get_setting(key, default=""):
    with connect() as con:
        row = con.execute("SELECT value FROM app_settings WHERE key=?", (key,)).fetchone()
    return row[0] if row else default

def set_setting(key, value):
    with connect() as con:
        con.execute("INSERT OR REPLACE INTO app_settings(key, value) VALUES(?,?)", (key, value))

def norm(text):
    return re.sub(r"[^A-Z0-9]+", " ", unicodedata.normalize("NFKD", text).encode("ASCII", "ignore").decode("ASCII").upper()).strip()

def safe_float(value, label, allow_blank=False):
    if allow_blank and not str(value).strip():
        return 0.0
    try:
        return float(str(value).replace(",", "."))
    except ValueError:
        raise ValueError(f"Informe um n\u00famero v\u00e1lido em {label}.")

def display_item(code, desc):
    return f"{code} | {desc}"

def code_from_display(text):
    return text.split(" | ", 1)[0].strip().upper()

def set_value(widget, value):
    if isinstance(widget, ttk.Combobox):
        widget.set(str(value))
    else:
        widget.delete(0, "end")
        widget.insert(0, str(value))

def block_mousewheel(widget):
    widget.bind("<MouseWheel>", lambda e: "break", add="+")
    widget.bind("<Button-4>", lambda e: "break", add="+")
    widget.bind("<Button-5>", lambda e: "break", add="+")

def normalize_url(value):
    value = value.strip()
    return "https://" + value if value and not value.startswith(("http://", "https://", "file://")) else value

def open_url(value):
    if not value:
        return messagebox.showwarning("MAPZER", "Informe um link primeiro.")
    webbrowser.open(normalize_url(value))

def whatsapp_url(phone):
    digits = re.sub(r"\D", "", phone or "")
    if not digits:
        raise ValueError("Informe um telefone/WhatsApp v\u00e1lido.")
    if len(digits) in (10, 11):
        digits = "55" + digits
    return "https://wa.me/" + digits

class ScrollableTab(tk.Frame):
    def __init__(self, parent):
        super().__init__(parent, bg=BG_APP)
        self.canvas = tk.Canvas(self, bg=BG_APP, highlightthickness=0)
        self.scrollbar = ttk.Scrollbar(self, orient="vertical", command=self.canvas.yview)
        self.body = tk.Frame(self.canvas, bg=BG_APP)
        self.window = self.canvas.create_window((0, 0), window=self.body, anchor="nw")
        self.canvas.configure(yscrollcommand=self.scrollbar.set)
        self.canvas.pack(side="left", fill="both", expand=True)
        self.scrollbar.pack(side="right", fill="y")
        self.body.bind("<Configure>", lambda e: self.canvas.configure(scrollregion=self.canvas.bbox("all")))
        self.canvas.bind("<Configure>", lambda e: self.canvas.itemconfigure(self.window, width=e.width))
        self.canvas.bind("<Enter>", self.enable_wheel)
        self.canvas.bind("<Leave>", self.disable_wheel)
        self.body.bind("<Enter>", self.enable_wheel)
        self.body.bind("<Leave>", self.disable_wheel)
        self.wheel_on = False

    def enable_wheel(self, event=None):
        if not self.wheel_on:
            self.wheel_on = True
            self.canvas.bind_all("<MouseWheel>", self.on_wheel, add="+")
            self.canvas.bind_all("<Button-4>", self.on_wheel, add="+")
            self.canvas.bind_all("<Button-5>", self.on_wheel, add="+")

    def disable_wheel(self, event=None):
        self.wheel_on = False

    def on_wheel(self, event):
        if not self.wheel_on:
            return
        focus = self.winfo_toplevel().focus_get()
        if isinstance(focus, (ttk.Combobox, tk.Entry, tk.Text)) and focus.winfo_toplevel() == self.winfo_toplevel():
            return
        if getattr(event, "num", 0) == 4 or getattr(event, "delta", 0) > 0:
            self.canvas.yview_scroll(-2, "units")
        elif getattr(event, "num", 0) == 5 or getattr(event, "delta", 0) < 0:
            self.canvas.yview_scroll(2, "units")
        return "break"

class SearchCombo(ttk.Combobox):
    def __init__(self, master, provider, callback=None, **kwargs):
        super().__init__(master, state="normal", **kwargs)
        self.provider = provider
        self.callback = callback
        self.bind("<KeyRelease>", self.filter_values)
        self.bind("<FocusOut>", self.on_selected)
        self.bind("<Return>", lambda e: self.refresh_values())
        block_mousewheel(self)
        self.refresh_values()

    def refresh_values(self):
        self["values"] = self.provider()

    def filter_values(self, event=None):
        if event and event.keysym in ("Up", "Down", "Left", "Right", "Return", "Tab", "Escape", "Shift_L", "Shift_R", "Control_L", "Control_R"):
            return
        text = self.get().strip().lower()
        vals = self.provider()
        self["values"] = [v for v in vals if text in v.lower()] if text else vals

    def on_selected(self, event=None):
        if self.callback:
            self.callback(self.get())

class SuggestList:
    def __init__(self, entry, provider, callback):
        self.entry = entry
        self.provider = provider
        self.callback = callback
        self.popup = None
        self.listbox = None
        entry.bind("<KeyRelease>", self.on_key, add="+")
        entry.bind("<Down>", self.down, add="+")
        entry.bind("<FocusOut>", lambda e: self.hide(), add="+")
        entry.bind("<Return>", lambda e: entry.after(180, self.hide), add="+")
        block_mousewheel(entry)

    def on_key(self, event=None):
        if event and event.keysym in ("Up", "Down", "Left", "Right", "Return", "Tab", "Escape", "Shift_L", "Shift_R", "Control_L", "Control_R"):
            return
        text = self.entry.get().strip().lower()
        if not text:
            self.hide()
            return
        vals = [v for v in self.provider() if text in str(v).lower()][:8]
        if vals:
            self.show(vals)
        else:
            self.hide()

    def show(self, vals):
        if not self.popup:
            self.popup = tk.Toplevel(self.entry)
            self.popup.overrideredirect(True)
            self.popup.attributes("-topmost", True)
            self.listbox = tk.Listbox(self.popup, bg=BG_PANEL, fg=TEXT, selectbackground=LIST_SEL, activestyle="none", font=("Segoe UI", 9))
            self.listbox.pack(fill="both", expand=True)
            self.listbox.bind("<Button-1>", self.pick)
            self.listbox.bind("<Return>", self.pick)
            block_mousewheel(self.listbox)
        self.listbox.delete(0, "end")
        for v in vals:
            self.listbox.insert("end", v)
        self.popup.geometry(f"{max(self.entry.winfo_width(), 430)}x{min(len(vals), 8)*23+3}+{self.entry.winfo_rootx()}+{self.entry.winfo_rooty()+self.entry.winfo_height()}")
        self.popup.deiconify()

    def down(self, event=None):
        if self.popup and self.listbox.size():
            self.listbox.focus_set()
            self.listbox.selection_set(0)
            return "break"

    def pick(self, event=None):
        if not self.listbox.curselection():
            return "break"
        v = self.listbox.get(self.listbox.curselection()[0])
        self.hide()
        self.callback(v)
        self.entry.focus_set()
        return "break"

    def hide(self):
        if self.popup:
            self.popup.withdraw()

class SupplierPanel:
    def __init__(self, app, parent, title, index, remove_callback=None):
        self.app = app
        self.index = index
        self.title = title
        self.visible = True
        self.frame = tk.LabelFrame(parent, text=f" {title} ", bg=BG_PANEL, fg="#0ea5e9", font=("Segoe UI", 10, "bold"), padx=10, pady=8)
        self.frame.pack(fill="x", pady=6)
        self.header = tk.Frame(self.frame, bg=BG_PANEL)
        self.header.grid(row=0, column=0, columnspan=4, sticky="ew", pady=(0, 5))
        self.header.columnconfigure(0, weight=1)
        self.toggle_button = RButton(self.header, text="OCULTAR INFORMA\u00c7\u00d5ES", command=self.toggle, bg="#64748b", fg="white", relief="flat", font=("Segoe UI", 8, "bold"), padx=8, pady=3)
        self.toggle_button.grid(row=0, column=1, padx=(4, 0))
        if remove_callback:
            RButton(self.header, text="REMOVER FORNECEDOR", command=remove_callback, bg="#dc2626", fg="white", relief="flat", font=("Segoe UI", 8, "bold"), padx=8, pady=3).grid(row=0, column=2, padx=(4, 0))
        self.content = tk.Frame(self.frame, bg=BG_PANEL)
        self.content.grid(row=1, column=0, columnspan=4, sticky="ew")
        self.content.columnconfigure(1, weight=1)
        self.content.columnconfigure(3, weight=1)
        self.widgets = {}
        self.add_field(0, 0, "Nome *", "name")
        self.add_field(0, 2, "Contato", "contact")
        self.add_field(1, 0, "Telefone / WhatsApp", "phone", phone=True)
        self.add_field(1, 2, "E-mail", "email")
        self.add_field(2, 0, "Site / loja", "website", link=True)
        self.add_field(2, 2, "Status", "status", values=SUPPLIER_STATUSES)
        self.add_field(3, 0, "SKU fornecedor", "sku")
        self.add_field(3, 2, "Link espec\u00edfico do item", "item_link", link=True)
        self.add_field(4, 0, "Pre\u00e7o praticado (R$)", "price", default="0")
        self.add_field(4, 2, "Prazo", "lead", default="0")
        self.add_field(5, 0, "Unidade prazo", "lead_unit", values=["horas", "dias"], default="dias")
        self.add_field(5, 2, "Quantidade m\u00ednima", "min_qty", default="0")
        self.add_field(6, 0, "Unidade m\u00ednima", "min_unit", values=UNITS)
        self.add_field(6, 2, "Condi\u00e7\u00e3o pagamento", "terms")
        self.add_field(7, 0, "Frete / retirada", "shipping")
        tk.Label(self.content, text="Observa\u00e7\u00f5es", bg=BG_PANEL, fg=TEXT_SOFT, font=("Segoe UI", 9, "bold")).grid(row=8, column=0, sticky="nw", pady=(5, 0))
        self.notes = tk.Text(self.content, height=2, wrap="word", font=("Segoe UI", 9))
        self.notes.grid(row=8, column=1, columnspan=3, sticky="ew", pady=(5, 0))
        block_mousewheel(self.notes)

    def toggle(self):
        self.visible = not self.visible
        if self.visible:
            self.content.grid()
            self.toggle_button.config(text="OCULTAR INFORMA\u00c7\u00d5ES", bg="#64748b")
        else:
            self.content.grid_remove()
            self.toggle_button.config(text="EXIBIR INFORMA\u00c7\u00d5ES", bg="#16a34a")

    def has_data(self):
        defaults = {"", "0", "0.0", "dias"}
        return any(w.get().strip().lower() not in defaults for w in self.widgets.values()) or bool(self.notes.get("1.0", "end").strip())

    def add_field(self, row, col, label, key, values=None, default="", link=False, phone=False):
        tk.Label(self.content, text=label, bg=BG_PANEL, fg=TEXT_SOFT, font=("Segoe UI", 8, "bold")).grid(row=row, column=col, sticky="w", padx=(0, 5), pady=2)
        holder = tk.Frame(self.content, bg=BG_PANEL)
        holder.grid(row=row, column=col+1, sticky="ew", padx=(0, 12), pady=2)
        holder.columnconfigure(0, weight=1)
        if values is None:
            w = tk.Entry(holder, bg=BG_APP, fg=TEXT, insertbackground=TEXT, highlightthickness=1, highlightbackground=ENTRY_BORDER, highlightcolor="#0ea5e9", relief="flat", bd=0, font=("Segoe UI", 9))
            if default:
                w.insert(0, default)
        else:
            w = ttk.Combobox(holder, values=values, state="normal", font=("Segoe UI", 9), height=8)
            if default:
                w.set(default)
        w.grid(row=0, column=0, sticky="ew", ipady=1)
        block_mousewheel(w)
        self.widgets[key] = w
        if key in ("name", "contact", "phone", "email", "website", "sku", "item_link", "terms", "shipping"):
            source = {"name": "supplier_name", "contact": "contact_name", "phone": "phone", "email": "email", "website": "website", "sku": "supplier_sku", "item_link": "item_link", "terms": "terms", "shipping": "shipping"}[key]
            SuggestList(w, lambda col=source: self.app.supplier_unique_values(col), lambda v, widget=w: set_value(widget, v))
        if link:
            RButton(holder, text="ABRIR", command=lambda widget=w: open_url(widget.get()), bg="#0ea5e9", fg="white", relief="flat", font=("Segoe UI", 8, "bold"), padx=6, pady=2).grid(row=0, column=1, padx=(4, 0))
        if phone:
            RButton(holder, text="WHATSAPP", command=lambda widget=w: self.open_whatsapp(widget.get()), bg="#16a34a", fg="white", relief="flat", font=("Segoe UI", 8, "bold"), padx=6, pady=2).grid(row=0, column=1, padx=(4, 0))

    def open_whatsapp(self, phone):
        try:
            webbrowser.open(whatsapp_url(phone))
        except Exception as e:
            messagebox.showerror("MAPZER", str(e))

    def values(self):
        return {k: w.get().strip() for k, w in self.widgets.items()} | {"notes": self.notes.get("1.0", "end").strip()}

    def load(self, row):
        keys = ["name", "contact", "phone", "email", "website", "sku", "item_link", "price", "lead", "lead_unit", "min_qty", "min_unit", "terms", "shipping", "status"]
        for k, v in zip(keys, row[:15]):
            set_value(self.widgets[k], "" if v is None else str(v))
        self.notes.delete("1.0", "end")
        self.notes.insert("1.0", row[15] or "")

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("MAPZER | ERP | V35")
        self.geometry("1300x920")
        self.minsize(850, 560)
        self.theme = get_setting("theme", "light")
        apply_palette(self.theme)
        self.loading = False
        self.code_auto = True
        self.class_auto = True
        self.p3d_visible = False
        self.selected_images = []
        self.supplier_panels = []
        self.level_names = self.load_level_names()
        self.build_ui()

    def build_ui(self):
        """Monta toda a interface a partir da paleta de cores atual.
        Chamado no inicio e sempre que o tema claro/escuro e alternado."""
        self.configure(bg=BG_APP)
        self.style = ttk.Style(self)
        self.style.theme_use("clam")
        self.style.configure(".", background=BG_APP)
        self.style.configure("TNotebook", background=BG_APP, borderwidth=0)
        self.style.configure("TNotebook.Tab", padding=(16, 9), font=("Segoe UI", 10, "bold"), background=TAB_BG, foreground=TAB_FG)
        self.style.map("TNotebook.Tab", background=[("selected", "#0ea5e9")], foreground=[("selected", "white")])
        self.style.configure("Treeview", background=BG_PANEL, foreground=TEXT, fieldbackground=BG_PANEL, rowheight=27, font=("Segoe UI", 10), borderwidth=0)
        self.style.configure("Treeview.Heading", background="#0f172a", foreground="white", font=("Segoe UI", 10, "bold"))
        # Combobox mais compacta (menos "alta") e coerente com o tema atual
        self.style.configure("TCombobox", padding=(6, 3), arrowsize=14, fieldbackground=BG_PANEL, background=BG_PANEL, foreground=TEXT)
        self.style.map("TCombobox", fieldbackground=[("readonly", BG_PANEL)], foreground=[("readonly", TEXT)])
        self.style.configure("TScrollbar", background=TAB_BG, troughcolor=BG_APP, borderwidth=0, arrowsize=12)
        self.build_header()
        self.tabs = ttk.Notebook(self)
        self.tabs.pack(fill="both", expand=True, padx=12, pady=12)
        self.build_items_tab()
        self.build_bom_tab()
        self.build_movement_tab()
        self.build_summary_tab()
        self.refresh_all()

    def toggle_theme(self):
        """Alterna entre tema claro e escuro, salva a preferencia e
        reconstroi a interface do zero (os dados ficam no banco, nada se
        perde)."""
        self.theme = "dark" if self.theme == "light" else "light"
        set_setting("theme", self.theme)
        apply_palette(self.theme)
        for w in self.winfo_children():
            w.destroy()
        self.code_auto = self.class_auto = True
        self.p3d_visible = False
        self.selected_images = []
        self.supplier_panels = []
        self.build_ui()

    def load_level_names(self):
        with connect() as con:
            rows = con.execute("SELECT level_num, level_name FROM level_config ORDER BY level_num").fetchall()
        return {num: name for num, name in rows}

    def get_level_display(self, level_num):
        name = self.level_names.get(level_num, "Principal")
        return f"{level_num} - {name}"

    def get_levels_list(self):
        return [self.get_level_display(i) for i in range(4)]

    def tab_body(self, tab, title, help_text):
        container = ScrollableTab(self.tabs)
        self.tabs.add(container, text=tab)
        page = container.body
        top = tk.Frame(page, bg=BG_APP)
        top.pack(fill="x", padx=18, pady=(14, 8))
        tk.Label(top, text=title, bg=BG_APP, fg=TEXT, font=("Segoe UI", 16, "bold")).pack(side="left")
        RButton(top, text="AJUDA", command=lambda: messagebox.showinfo("Ajuda", help_text), bg="#0ea5e9", fg="white", relief="flat", padx=14, pady=6).pack(side="right")
        return page

    def build_header(self):
        h = tk.Frame(self, bg="#1e293b", height=68)
        h.pack(fill="x")
        h.pack_propagate(False)
        tk.Label(h, text="MAPZER", bg="#1e293b", fg="white", font=("Segoe UI", 22, "bold")).pack(side="left", padx=24)
        tk.Label(h, text="CONTROLE DE ITENS \u2022 ESTRUTURA \u2022 ESTOQUE \u2022 V35", bg="#1e293b", fg="#38bdf8", font=("Segoe UI", 10, "bold")).pack(side="left")
        # Botao de configuracao de niveis
        RButton(h, text="CONFIGURAR NIVEIS", command=self.open_level_config, bg="#0ea5e9", fg="white", padx=12, pady=6, bg_outer="#1e293b").pack(side="right", padx=12)
        # Botao de alternancia de tema claro/escuro
        theme_label = "MODO CLARO" if self.theme == "dark" else "MODO ESCURO"
        RButton(h, text=theme_label, command=self.toggle_theme, bg="#334155", fg="white", padx=12, pady=6, bg_outer="#1e293b").pack(side="right", padx=(0, 6))

    def open_level_config(self):
        """Abre janela para editar nomes dos niveis"""
        win = tk.Toplevel(self)
        win.title("Configurar N\u00edveis")
        win.geometry("500x350")
        win.configure(bg=BG_APP)
        win.transient(self)
        win.grab_set()
        
        tk.Label(win, text="CONFIGURAR NOMES DOS N\u00cdVEIS", bg=BG_APP, fg="#0ea5e9", font=("Segoe UI", 14, "bold")).pack(pady=10)
        
        form = tk.Frame(win, bg=BG_APP, padx=20, pady=10)
        form.pack(fill="both", expand=True)
        form.columnconfigure(1, weight=1)
        
        entries = []
        for i in range(4):
            current_name = self.level_names.get(i, "")
            tk.Label(form, text=f"N\u00edvel {i}:", bg=BG_APP, fg=TEXT_SOFT, font=("Segoe UI", 10, "bold")).grid(row=i, column=0, sticky="w", pady=8)
            entry = tk.Entry(form, bg=BG_PANEL, fg=TEXT, font=("Segoe UI", 10))
            entry.insert(0, current_name)
            entry.grid(row=i, column=1, sticky="ew", pady=8, padx=(10, 0))
            entries.append(entry)
        
        def save():
            with connect() as con:
                for i, entry in enumerate(entries):
                    name = entry.get().strip()
                    if name:
                        con.execute("INSERT OR REPLACE INTO level_config(level_num, level_name) VALUES(?,?)", (i, name))
            self.level_names = self.load_level_names()
            messagebox.showinfo("MAPZER", "N\u00edveis atualizados com sucesso!")
            win.destroy()
        
        RButton(win, text="SALVAR", command=save, bg="#16a34a", fg="white", relief="flat", padx=20, pady=8, font=("Segoe UI", 10, "bold")).pack(pady=10)
        RButton(win, text="CANCELAR", command=win.destroy, bg="#64748b", fg="white", relief="flat", padx=20, pady=8).pack(pady=5)

    def field(self, parent, row, label, values=None, default="", editable=False):
        tk.Label(parent, text=label, bg=BG_APP, fg=TEXT_SOFT, font=("Segoe UI", 9, "bold")).grid(row=row, column=0, sticky="w", padx=(18, 8), pady=4)
        if values is None:
            w = tk.Entry(parent, bg=BG_PANEL, fg=TEXT, insertbackground=TEXT, highlightthickness=1, highlightbackground=ENTRY_BORDER, highlightcolor="#0ea5e9", relief="flat", bd=0, font=("Segoe UI", 9))
            if default:
                w.insert(0, default)
        else:
            w = ttk.Combobox(parent, values=values, state="normal" if editable else "readonly", font=("Segoe UI", 9), height=8)
            if default:
                w.set(default)
        block_mousewheel(w)
        w.grid(row=row, column=1, sticky="ew", padx=(0, 18), pady=4, ipady=2)
        return w

    def item_values(self):
        with connect() as con:
            return [display_item(c, d) for c, d in con.execute("SELECT code, description FROM items ORDER BY code")]

    def supplier_unique_values(self, column):
        with connect() as con:
            return [str(r[0]) for r in con.execute(f"SELECT DISTINCT {column} FROM suppliers WHERE {column} IS NOT NULL AND TRIM({column})<>'' ORDER BY {column}")]

    def unique_item_values(self, column):
        with connect() as con:
            return [str(r[0]) for r in con.execute(f"SELECT DISTINCT {column} FROM items WHERE {column} IS NOT NULL AND TRIM({column})<>'' ORDER BY {column}")]

    def exists(self, code):
        with connect() as con:
            return con.execute("SELECT 1 FROM items WHERE code=?", (code,)).fetchone() is not None

    def root_codes(self):
        """Codigos dos itens de Nivel 0 (raiz), calculados dinamicamente.
        Substitui o antigo ROOT_CODES fixo (que nunca era populado) e o
        ROOT_CODE fixo (que nao acompanhava o codigo real cadastrado)."""
        with connect() as con:
            return {r[0] for r in con.execute("SELECT code FROM items WHERE level=0")}

    def classify(self, desc):
        d = norm(desc)
        rules = [("Consum\u00edvel", ["FILAMENTO", "ETIQUETA", "LACRE", "ADESIVO", "COLA", "RESINA"]), ("Fixa\u00e7\u00e3o", ["PARAFUSO", "PORCA", "ARRUELA", "REBITE", "INSERTO"]), ("Sensor", ["CAMERA", "LIDAR", "GPS", "IMU", "SENSOR", "RADAR"]), ("El\u00e9trica", ["FONTE", "INVERSOR", "DISJUNTOR", "RELE", "FUSIVEL", "BATERIA"]), ("Eletr\u00f4nica/Automa\u00e7\u00e3o", ["JETSON", "ESP32", "RASPBERRY", "PLACA", "DRIVER"]), ("Cabeamento", ["CABO", "CHICOTE", "MALHA"]), ("Impress\u00e3o 3D", ["BICO", "HOTEND", "PEI", "PTFE", "EXTRUSOR"]), ("Mec\u00e2nica fabricada", ["SUPORTE", "BASE", "ADAPTADOR"]), ("Carenagem/Domo", ["DOMO", "CARENAGEM", "TAMPA"]), ("Estrutural", ["PERFIL", "CHAPA", "TUBO", "DOBRADICA"])]
        return next((k for k, t in rules if any(x in d for x in t)), "")

    def code_suggestion(self, desc, cls):
        d = norm(desc)
        prefix = {"Estrutural": "EST", "Carenagem/Domo": "DOM", "Fixa\u00e7\u00e3o": "FIX", "El\u00e9trica": "ELE", "Eletr\u00f4nica/Automa\u00e7\u00e3o": "AUT", "Sensor": "SEN", "Cabeamento": "CBL", "Conex\u00e3o el\u00e9trica": "CON", "Mec\u00e2nica fabricada": "MEC", "Impress\u00e3o 3D": "IMP", "Consum\u00edvel": "CNS"}.get(cls, "ITM")
        typ = "PAR" if "PARAFUSO" in d else "POR" if "PORCA" in d else "ARR" if "ARRUELA" in d else "FIL" if "FILAMENTO" in d else "SUP" if "SUPORTE" in d else "CAM" if "CAMERA" in d else "EST"
        m = re.search(r"\b(M\s*\d+\s*[Xx]\s*\d+)\b", d)
        measure = re.sub(r"\s+", "", m.group(1)).upper() if m else ""
        mat = "PA6GF" if "PA6" in d and "GF" in d else "PA12" if "PA12" in d else "PETG" if "PETG" in d else "ABS" if "ABS" in d else "PLA" if "PLA" in d else ""
        base = "-".join(x for x in [prefix, typ, measure, mat] if x) or "ITM"
        with connect() as con:
            existing = {r[0] for r in con.execute("SELECT code FROM items")}
        c, n = base, 1
        while c in existing:
            c = f"{base}-{n:02d}"
            n += 1
        return c

    def description_changed(self, event=None):
        if self.loading:
            return
        text = self.i_desc.get().strip()
        if not text:
            return
        if self.class_auto:
            s = self.classify(text)
            if s:
                self.i_class.set(s)
                self.i_hint.config(text=f"Classifica\u00e7\u00e3o sugerida: {s}. Voc\u00ea pode alterar livremente.")
        self.update_code()

    def code_text_changed(self, event=None):
        if not self.loading:
            self.code_auto = False

    def class_changed(self, event=None):
        if not self.loading:
            self.class_auto = False
            self.update_code()

    def update_code(self):
        if self.i_desc.get().strip() and self.i_class.get().strip() and (self.code_auto or not self.i_code.get().strip()):
            v = self.code_suggestion(self.i_desc.get(), self.i_class.get())
            set_value(self.i_code, v)
            self.code_auto = True
            self.i_code_hint.config(text=f"C\u00f3digo sugerido: {v}. Voc\u00ea pode edit\u00e1-lo.")

    def load_from_suggestion(self, v):
        code = code_from_display(v)
        set_value(self.i_code, code)
        self.load_item(code)

    def show_3d_button_if_needed(self, event=None):
        show = self.i_origin.get().strip() in ("Interna - Impress\u00e3o 3D", "Terceiro - Impress\u00e3o 3D")
        if show:
            if not self.btn_3d.winfo_ismapped():
                self.btn_3d.pack(anchor="w", padx=18, pady=7, before=self.buttons_bar)
        else:
            if self.p3d_visible:
                self.toggle_3d()
            self.btn_3d.pack_forget()

    def toggle_3d(self):
        self.p3d_visible = not self.p3d_visible
        if self.p3d_visible:
            self.p3d_frame.pack(fill="x", padx=18, pady=(0, 8), before=self.buttons_bar)
            self.btn_3d.config(text="- OCULTAR PAR\u00c2METROS DE IMPRESS\u00c3O 3D", bg="#dc2626")
        else:
            self.p3d_frame.pack_forget()
            self.btn_3d.config(text="+ PAR\u00c2METROS DE IMPRESS\u00c3O 3D", bg="#16a34a")

    def select_images(self):
        paths = filedialog.askopenfilenames(title="Selecionar at\u00e9 3 fotos", filetypes=[("Imagens", "*.png *.jpg *.jpeg *.bmp")])
        if not paths:
            return
        unique = []
        for p in self.selected_images + list(paths):
            if p not in unique:
                unique.append(p)
        self.selected_images = unique[:3]
        self.refresh_image_status()
        if len(unique) > 3:
            messagebox.showinfo("MAPZER", "Somente as 3 primeiras fotos foram mantidas.")

    def refresh_image_status(self):
        if not self.selected_images:
            self.image_status.config(text="Nenhuma foto anexada", fg=MUTED_TEXT)
        else:
            self.image_status.config(text=f"{len(self.selected_images)} foto(s): " + ", ".join(Path(p).name for p in self.selected_images), fg="#16a34a")

    def clear_images(self):
        self.selected_images = []
        self.refresh_image_status()

    def copy_images(self, code):
        saved = []
        for i, source in enumerate(self.selected_images[:3], 1):
            src = Path(source)
            if not src.exists():
                saved.append(str(src))
                continue
            dest = IMAGES_DIR / f"{code}_{i}{src.suffix.lower()}"
            if src.resolve() != dest.resolve():
                shutil.copy2(src, dest)
            saved.append(str(dest))
        return saved

    def add_supplier_panel(self, title=None):
        i = len(self.supplier_panels) + 1
        panel = SupplierPanel(self, self.suppliers_container, title or f"Fornecedor alternativo {i}", i, lambda: self.remove_supplier_panel(panel))
        self.supplier_panels.append(panel)
        return panel

    def remove_supplier_panel(self, panel):
        if panel.has_data() and not messagebox.askyesno("Confirmar remo\u00e7\u00e3o", f"O {panel.title} possui informa\u00e7\u00f5es preenchidas.\n\nDeseja remover este fornecedor alternativo?"):
            return
        self.supplier_panels = [p for p in self.supplier_panels if p is not panel]
        panel.frame.destroy()

    def clear_supplier_panels(self):
        for p in self.supplier_panels:
            p.frame.destroy()
        self.supplier_panels = []

    def build_items_tab(self):
        page = self.tab_body("1. ADICIONAR NOVO ITEM", "Cadastro e edi\u00e7\u00e3o de itens com selecao de nivel", "Cadastre itens definindo o nivel hierarquico (0, 1, 2, 3). Use o botao CONFIGURAR NIVEIS no topo para editar os nomes.")
        self.i_hint = tk.Label(page, text="Digite c\u00f3digo ou descri\u00e7\u00e3o para localizar itens ou criar um novo cadastro.", bg=BG_APP, fg="#0ea5e9", font=("Segoe UI", 9, "italic"))
        self.i_hint.pack(anchor="w", padx=18)
        self.i_code_hint = tk.Label(page, text="", bg=BG_APP, fg="#0ea5e9", font=("Segoe UI", 9, "italic"))
        self.i_code_hint.pack(anchor="w", padx=18)
        form = tk.Frame(page, bg=BG_APP)
        form.pack(fill="x")
        form.columnconfigure(1, weight=1)
        self.i_code = self.field(form, 0, "C\u00f3digo *")
        self.i_code.bind("<KeyRelease>", self.code_text_changed)
        self.i_code.bind("<Return>", lambda e: self.load_item(self.i_code.get().strip().upper()))
        self.i_desc = self.field(form, 1, "Descri\u00e7\u00e3o *")
        self.i_desc.bind("<KeyRelease>", self.description_changed)
        self.i_class = self.field(form, 2, "Classifica\u00e7\u00e3o *", CLASSIFICATIONS, editable=True)
        self.i_class.bind("<<ComboboxSelected>>", self.class_changed)
        self.i_class.bind("<KeyRelease>", self.class_changed)
        self.i_unit = self.field(form, 3, "Unidade *", UNITS, editable=True)
        self.i_acq = self.field(form, 4, "Aquisi\u00e7\u00e3o", ACQUISITIONS, editable=True)
        self.i_origin = self.field(form, 5, "Origem de fabrica\u00e7\u00e3o", ORIGINS, editable=True)
        self.i_origin.bind("<<ComboboxSelected>>", self.show_3d_button_if_needed)
        self.i_origin.bind("<KeyRelease>", self.show_3d_button_if_needed)
        
        # Campo NIVEL com nomes editaveis
        self.i_level = self.field(form, 6, "N\u00edvel *", self.get_levels_list(), self.get_level_display(0), True)
        
        self.suppliers_container = tk.Frame(page, bg=BG_APP)
        self.suppliers_container.pack(fill="x", padx=18, pady=(4, 2))
        self.primary_supplier = SupplierPanel(self, self.suppliers_container, "Fornecedor principal", 0)
        RButton(page, text="+ ADICIONAR FORNECEDOR ALTERNATIVO", command=self.add_supplier_panel, bg="#16a34a", fg="white", relief="flat", padx=14, pady=7, font=("Segoe UI", 10, "bold")).pack(anchor="w", padx=18, pady=(2, 8))
        extra = tk.Frame(page, bg=BG_APP)
        extra.pack(fill="x")
        extra.columnconfigure(1, weight=1)
        self.i_link = self.field(extra, 0, "Link geral de compra/arquivo")
        self.i_lead = self.field(extra, 1, "Prazo geral", default="0")
        self.i_lead_unit = self.field(extra, 2, "Unidade do prazo", ["horas", "dias"], "dias", True)
        self.i_cost = self.field(extra, 3, "Custo unit\u00e1rio geral (R$)", default="0")
        self.i_stock = self.field(extra, 4, "Quantidade inicial", default="0")
        self.i_initial_type = self.field(extra, 5, "Tipo da quantidade inicial", INITIAL_ENTRIES, "N\u00e3o adicionar ao estoque", True)
        self.i_location = self.field(extra, 6, "Localiza\u00e7\u00e3o")
        tk.Label(extra, text="Observa\u00e7\u00f5es / Ficha t\u00e9cnica", bg=BG_APP, fg=TEXT_SOFT, font=("Segoe UI", 10, "bold")).grid(row=7, column=0, sticky="nw", padx=(18, 8), pady=6)
        box = tk.Frame(extra, bg=BG_APP)
        box.grid(row=7, column=1, sticky="ew", padx=(0, 18), pady=6)
        box.columnconfigure(0, weight=1)
        self.note_tabs = ttk.Notebook(box)
        self.note_tabs.grid(row=0, column=0, sticky="ew")
        self.note_obs = tk.Text(self.note_tabs, height=3, wrap="word", font=("Segoe UI", 9))
        self.note_tech = tk.Text(self.note_tabs, height=3, wrap="word", font=("Segoe UI", 9))
        self.note_tabs.add(self.note_obs, text="Observa\u00e7\u00f5es")
        self.note_tabs.add(self.note_tech, text="Ficha t\u00e9cnica")
        block_mousewheel(self.note_obs)
        block_mousewheel(self.note_tech)
        attach = tk.Frame(page, bg=BG_APP)
        attach.pack(fill="x", padx=18, pady=8)
        RButton(attach, text="SELECIONAR FOTOS (AT\u00c9 3)", command=self.select_images, bg="#0ea5e9", fg="white", relief="flat", padx=12, pady=6).pack(side="left")
        RButton(attach, text="LIMPAR FOTOS", command=self.clear_images, bg="#64748b", fg="white", relief="flat", padx=12, pady=6).pack(side="left", padx=6)
        self.image_status = tk.Label(attach, text="Nenhuma foto anexada", bg=BG_APP, fg=MUTED_TEXT, font=("Segoe UI", 9, "italic"))
        self.image_status.pack(side="left", padx=8)
        self.btn_3d = RButton(page, text="+ PAR\u00c2METROS DE IMPRESS\u00c3O 3D", command=self.toggle_3d, bg="#16a34a", fg="white", relief="flat", padx=14, pady=7, font=("Segoe UI", 10, "bold"))
        self.p3d_frame = tk.LabelFrame(page, text=" Par\u00e2metros de Impress\u00e3o 3D ", bg=BG_PANEL, fg="#0ea5e9", font=("Segoe UI", 10, "bold"), padx=12, pady=10)
        self.p3d_frame.columnconfigure(1, weight=1)
        self.p3d_frame.columnconfigure(3, weight=1)
        def pf(r, c, l, w):
            tk.Label(self.p3d_frame, text=l, bg=BG_PANEL, fg=TEXT_SOFT, font=("Segoe UI", 9, "bold")).grid(row=r, column=c, sticky="w", padx=(0, 5), pady=4)
            w.grid(row=r, column=c+1, sticky="ew", padx=(0, 14), pady=4)
            block_mousewheel(w)
        self.p3d_material = ttk.Combobox(self.p3d_frame, values=MATERIALS_3D, state="normal", font=("Segoe UI", 9), height=8)
        self.p3d_material.set("ABS")
        self.p3d_nozzle = tk.Entry(self.p3d_frame)
        self.p3d_nozzle.insert(0, "245")
        self.p3d_bed = tk.Entry(self.p3d_frame)
        self.p3d_bed.insert(0, "100")
        self.p3d_infill = tk.Entry(self.p3d_frame)
        self.p3d_infill.insert(0, "20%")
        self.p3d_layer = tk.Entry(self.p3d_frame)
        self.p3d_layer.insert(0, "0.20")
        self.p3d_nozzle_size = tk.Entry(self.p3d_frame)
        self.p3d_nozzle_size.insert(0, "0.40")
        self.p3d_weight = tk.Entry(self.p3d_frame)
        self.p3d_time = tk.Entry(self.p3d_frame)
        pf(0, 0, "Material:", self.p3d_material)
        pf(0, 2, "Temp. bico (C):", self.p3d_nozzle)
        pf(1, 0, "Temp. mesa (C):", self.p3d_bed)
        pf(1, 2, "Preenchimento:", self.p3d_infill)
        pf(2, 0, "Altura camada (mm):", self.p3d_layer)
        pf(2, 2, "Bico (mm):", self.p3d_nozzle_size)
        pf(3, 0, "Peso estimado (g):", self.p3d_weight)
        pf(3, 2, "Tempo estimado:", self.p3d_time)
        self.buttons_bar = tk.Frame(page, bg=BG_APP)
        self.buttons_bar.pack(fill="x", padx=18, pady=10)
        RButton(self.buttons_bar, text="LIMPAR", command=self.clear_item, bg="#64748b", fg="white", relief="flat", padx=18, pady=8).pack(side="left")
        RButton(self.buttons_bar, text="ATUALIZAR C\u00d3DIGO", command=lambda: (setattr(self, "code_auto", True), self.update_code()), bg="#0ea5e9", fg="white", relief="flat", padx=14, pady=8).pack(side="left", padx=8)
        RButton(self.buttons_bar, text="EXCLUIR ITEM", command=self.delete_item, bg="#dc2626", fg="white", relief="flat", padx=14, pady=8).pack(side="left")
        RButton(self.buttons_bar, text="SALVAR / ATUALIZAR ITEM", command=self.save_item, bg="#16a34a", fg="white", relief="flat", padx=18, pady=8).pack(side="right")
        self.suggestions = [SuggestList(self.i_code, self.item_values, self.load_from_suggestion), SuggestList(self.i_desc, self.item_values, self.load_from_suggestion), SuggestList(self.i_link, lambda: self.unique_item_values("purchase_link"), lambda v: set_value(self.i_link, v)), SuggestList(self.i_location, lambda: self.unique_item_values("location"), lambda v: set_value(self.i_location, v))]

    def notes_text(self):
        return f"[OBSERVACOES]\n{self.note_obs.get('1.0', 'end').strip()}\n[/OBSERVACOES]\n[FICHA_TECNICA]\n{self.note_tech.get('1.0', 'end').strip()}\n[/FICHA_TECNICA]"

    def set_notes(self, text):
        def ext(a, b):
            m = re.search(re.escape(a) + r"\n?(.*?)\n?" + re.escape(b), text, re.S)
            return m.group(1).strip() if m else ""
        obs = ext("[OBSERVACOES]", "[/OBSERVACOES]")
        tech = ext("[FICHA_TECNICA]", "[/FICHA_TECNICA]")
        if not obs and not tech:
            obs = text
        self.note_obs.delete("1.0", "end")
        self.note_obs.insert("1.0", obs)
        self.note_tech.delete("1.0", "end")
        self.note_tech.insert("1.0", tech)

    def save_suppliers(self, con, code):
        con.execute("DELETE FROM suppliers WHERE item_code=?", (code,))
        panels = [self.primary_supplier] + self.supplier_panels
        for i, p in enumerate(panels):
            d = p.values()
            if not d["name"]:
                continue
            con.execute("INSERT INTO suppliers(item_code, supplier_name, contact_name, phone, email, website, supplier_sku, item_link, price, lead_value, lead_unit, minimum_qty, minimum_unit, terms, shipping, status, notes, sort_order, created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (code, d["name"], d["contact"], d["phone"], d["email"], d["website"], d["sku"], d["item_link"], safe_float(d["price"], "Pre\u00e7o", True), safe_float(d["lead"], "Prazo fornecedor", True), d["lead_unit"], safe_float(d["min_qty"], "Quantidade m\u00ednima", True), d["min_unit"], d["terms"], d["shipping"], d["status"], d["notes"], i, datetime.now().isoformat(timespec="seconds")))

    def save_images(self, con, code, images):
        old = [r[0] for r in con.execute("SELECT image_path FROM item_images WHERE item_code=?", (code,))]
        con.execute("DELETE FROM item_images WHERE item_code=?", (code,))
        for i, p in enumerate(images, 1):
            con.execute("INSERT INTO item_images(item_code, image_path, sort_order, created_at) VALUES(?,?,?,?)", (code, p, i, datetime.now().isoformat(timespec="seconds")))
        con.execute("UPDATE items SET image_path=? WHERE code=?", (images[0] if images else "", code))
        for oldp in old:
            if oldp and oldp not in images:
                try:
                    Path(oldp).unlink(missing_ok=True)
                except Exception:
                    pass

    def load_suppliers(self, code):
        with connect() as con:
            rows = con.execute("SELECT supplier_name, contact_name, phone, email, website, supplier_sku, item_link, price, lead_value, lead_unit, minimum_qty, minimum_unit, terms, shipping, status, notes FROM suppliers WHERE item_code=? ORDER BY sort_order, id", (code,)).fetchall()
        self.clear_supplier_panels()
        empty = ["", "", "", "", "", "", "", 0, 0, "dias", 0, "", "", "", "", ""]
        self.primary_supplier.load(rows[0] if rows else empty)
        for i, row in enumerate(rows[1:], 1):
            panel = self.add_supplier_panel(f"Fornecedor alternativo {i}")
            panel.load(row)

    def load_item(self, code):
        if not self.exists(code):
            return
        with connect() as con:
            row = con.execute("SELECT description, classification, unit, acquisition, manufacturing_origin, purchase_link, lead_value, lead_unit, unit_cost, location, notes, level FROM items WHERE code=?", (code,)).fetchone()
            images = [r[0] for r in con.execute("SELECT image_path FROM item_images WHERE item_code=? ORDER BY sort_order, id", (code,))]
        self.loading = True
        for w, v in zip([self.i_desc, self.i_class, self.i_unit, self.i_acq, self.i_origin, self.i_link, self.i_lead, self.i_lead_unit, self.i_cost, self.i_location], row[:10]):
            set_value(w, "" if v is None else str(v))
        # Carrega nivel
        level_num = row[11] if len(row) > 11 else 0
        set_value(self.i_level, self.get_level_display(level_num))
        self.set_notes(row[10] or "")
        self.selected_images = images
        self.refresh_image_status()
        self.load_suppliers(code)
        self.loading = False
        self.code_auto = self.class_auto = False
        self.show_3d_button_if_needed()

    def clear_item(self):
        self.loading = True
        for w, v in [(self.i_code, ""), (self.i_desc, ""), (self.i_class, ""), (self.i_unit, ""), (self.i_acq, ""), (self.i_origin, ""), (self.i_link, ""), (self.i_lead, "0"), (self.i_lead_unit, "dias"), (self.i_cost, "0"), (self.i_stock, "0"), (self.i_initial_type, "N\u00e3o adicionar ao estoque"), (self.i_location, "")]:
            set_value(w, v)
        set_value(self.i_level, self.get_level_display(0))
        self.primary_supplier.load(["", "", "", "", "", "", "", 0, 0, "dias", 0, "", "", "", "", ""])
        self.clear_supplier_panels()
        self.note_obs.delete("1.0", "end")
        self.note_tech.delete("1.0", "end")
        self.loading = False
        self.code_auto = self.class_auto = True
        self.selected_images = []
        self.refresh_image_status()
        if self.p3d_visible:
            self.toggle_3d()
        self.btn_3d.pack_forget()
        self.i_hint.config(text="Digite c\u00f3digo ou descri\u00e7\u00e3o para localizar itens ou criar um novo cadastro.")
        self.i_code_hint.config(text="")

    def save_item(self):
        try:
            code = self.i_code.get().strip().upper()
            desc = self.i_desc.get().strip()
            cls = self.i_class.get().strip()
            unit = self.i_unit.get().strip()
            if not all([code, desc, cls, unit]):
                raise ValueError("Preencha C\u00f3digo, Descri\u00e7\u00e3o, Classifica\u00e7\u00e3o e Unidade.")
            
            # Extrai nivel do campo
            level_text = self.i_level.get().strip()
            level_num = int(level_text.split(" - ")[0]) if " - " in level_text else 0
            
            primary = self.primary_supplier.values()
            notes = self.notes_text()
            if self.i_origin.get() in ("Interna - Impress\u00e3o 3D", "Terceiro - Impress\u00e3o 3D"):
                notes += f"\n[PARAMETROS_3D]\nMaterial: {self.p3d_material.get()}\nTemp. bico: {self.p3d_nozzle.get()} C\nTemp. mesa: {self.p3d_bed.get()} C\nPreenchimento: {self.p3d_infill.get()}\nAltura camada: {self.p3d_layer.get()} mm\nDi\u00e2metro bico: {self.p3d_nozzle_size.get()} mm\nPeso estimado: {self.p3d_weight.get()} g\nTempo estimado: {self.p3d_time.get()}\n[/PARAMETROS_3D]"
            lead = safe_float(self.i_lead.get(), "Prazo geral")
            cost = safe_float(self.i_cost.get(), "Custo geral")
            stock = safe_float(self.i_stock.get(), "Quantidade inicial")
            images = self.copy_images(code)
            data = (desc, cls, unit, self.i_acq.get(), self.i_origin.get(), primary["name"], self.i_link.get(), lead, self.i_lead_unit.get(), cost, self.i_location.get(), notes, images[0] if images else "", level_num)
            with connect() as con:
                if con.execute("SELECT 1 FROM items WHERE code=?", (code,)).fetchone():
                    con.execute("UPDATE items SET description=?, classification=?, unit=?, acquisition=?, manufacturing_origin=?, supplier=?, purchase_link=?, lead_value=?, lead_unit=?, unit_cost=?, location=?, notes=?, image_path=?, level=? WHERE code=?", data + (code,))
                    msg = "Item atualizado com sucesso."
                else:
                    con.execute("INSERT INTO items(code, description, classification, unit, acquisition, manufacturing_origin, supplier, purchase_link, lead_value, lead_unit, unit_cost, location, notes, image_path, level, created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (code,) + data + (datetime.now().isoformat(timespec="seconds"),))
                    msg = "Item cadastrado com sucesso."
                    initial = self.i_initial_type.get()
                    if stock and initial != "N\u00e3o adicionar ao estoque":
                        con.execute("INSERT INTO movements(created_at, movement_type, item_code, quantity, reference, responsible, notes) VALUES(?,?,?,?,?,?,?)", (datetime.now().isoformat(timespec="seconds"), initial, code, stock, "Cadastro inicial", "", "Quantidade inicial cadastrada"))
                self.save_suppliers(con, code)
                self.save_images(con, code, images)
            self.clear_item()
            self.refresh_all()
            messagebox.showinfo("MAPZER", msg)
        except Exception as e:
            log_error(traceback.format_exc())
            messagebox.showerror("MAPZER", str(e))

    def delete_item(self):
        code = self.i_code.get().strip().upper()
        if not code:
            return messagebox.showwarning("MAPZER", "Informe ou selecione o c\u00f3digo do item que deseja excluir.")
        if code in self.root_codes():
            return messagebox.showerror("MAPZER", "Os itens principais (N\u00edvel 0) n\u00e3o podem ser exclu\u00eddos.")
        if not self.exists(code):
            return messagebox.showerror("MAPZER", "Item n\u00e3o encontrado.")
        if not messagebox.askyesno("Confirmar exclus\u00e3o", f"Excluir permanentemente o item {code}?\n\nOs v\u00ednculos da estrutura, fornecedores, fotos e movimenta\u00e7\u00f5es tamb\u00e9m ser\u00e3o removidos."):
            return
        with connect() as con:
            images = [r[0] for r in con.execute("SELECT image_path FROM item_images WHERE item_code=?", (code,))]
            con.execute("DELETE FROM item_images WHERE item_code=?", (code,))
            con.execute("DELETE FROM suppliers WHERE item_code=?", (code,))
            con.execute("DELETE FROM bom WHERE parent_code=? OR child_code=?", (code, code))
            con.execute("DELETE FROM movements WHERE item_code=?", (code,))
            con.execute("DELETE FROM items WHERE code=?", (code,))
        for p in images:
            try:
                Path(p).unlink(missing_ok=True)
            except Exception:
                pass
        self.clear_item()
        self.refresh_all()
        messagebox.showinfo("MAPZER", "Item exclu\u00eddo com sucesso.")

    def build_bom_tab(self):
        page = self.tab_body("2. ESTRUTURA", "Estrutura em cascata", "Monte a arvore hierarquica com base nos niveis dos itens.")
        form = tk.Frame(page, bg=BG_APP)
        form.pack(fill="x")
        form.columnconfigure(1, weight=1)
        self.b_parent = self.search_field(form, 0, "Componente pai *", "")
        self.b_child = self.search_field(form, 1, "Componente filho *")
        self.b_qty = self.field(form, 2, "Quantidade *", default="1")
        self.b_required = self.field(form, 3, "Obrigat\u00f3ria?", ["SIM", "N\u00c3O"], "SIM", True)
        self.b_location = self.field(form, 4, "Local de montagem")
        bar = tk.Frame(page, bg=BG_APP)
        bar.pack(fill="x", padx=18, pady=8)
        RButton(bar, text="LIMPAR", command=self.clear_bom, bg="#64748b", fg="white", relief="flat", padx=14, pady=8).pack(side="left")
        RButton(bar, text="REMOVER DA ESTRUTURA", command=self.remove_bom, bg="#dc2626", fg="white", relief="flat", padx=14, pady=8).pack(side="left", padx=8)
        RButton(bar, text="SUBIR", command=lambda: self.move_bom(-1), bg="#64748b", fg="white", relief="flat", padx=14, pady=8).pack(side="left")
        RButton(bar, text="DESCER", command=lambda: self.move_bom(1), bg="#64748b", fg="white", relief="flat", padx=14, pady=8).pack(side="left", padx=8)
        RButton(bar, text="ADICIONAR \u00c0 ESTRUTURA", command=self.save_bom, bg="#0ea5e9", fg="white", relief="flat", padx=18, pady=8).pack(side="right")
        self.bom_tree = self.make_tree(page, ("C\u00f3digo", "Descri\u00e7\u00e3o", "N\u00edvel", "Qtd.", "Obrigat\u00f3ria", "Local"), (190, 310, 80, 70, 110, 240), True)
        self.bom_tree.tag_configure("parent", background=ROW_HL, foreground=TEXT, font=("Segoe UI", 10, "bold"))
        self.bom_tree.tag_configure("root", background="#0f172a", foreground="white", font=("Segoe UI", 10, "bold"))
        self.bom_tree.bind("<Double-1>", self.bom_double_click)

    def search_field(self, parent, row, label, default=""):
        tk.Label(parent, text=label, bg=BG_APP, fg=TEXT_SOFT, font=("Segoe UI", 9, "bold")).grid(row=row, column=0, sticky="w", padx=(18, 8), pady=4)
        w = SearchCombo(parent, self.item_values, font=("Segoe UI", 9), height=8)
        w.set(default)
        w.grid(row=row, column=1, sticky="ew", padx=(0, 18), pady=4, ipady=2)
        return w

    def clear_bom(self):
        self.b_parent.set("")
        self.b_child.set("")
        set_value(self.b_qty, "1")
        self.b_required.set("SIM")
        set_value(self.b_location, "")

    def would_create_cycle(self, parent, child):
        if parent == child:
            return True
        with connect() as con:
            edges = con.execute("SELECT parent_code, child_code FROM bom").fetchall()
        graph = {}
        for p, c in edges:
            graph.setdefault(p, []).append(c)
        stack = [child]
        seen = set()
        while stack:
            cur = stack.pop()
            if cur == parent:
                return True
            if cur not in seen:
                seen.add(cur)
                stack.extend(graph.get(cur, []))
        return False

    def save_bom(self):
        try:
            p = code_from_display(self.b_parent.get()) if self.b_parent.get() else ""
            c = code_from_display(self.b_child.get()) if self.b_child.get() else ""
            q = safe_float(self.b_qty.get(), "Quantidade")
            
            if not p or not c:
                raise ValueError("Selecione Componente pai e Componente filho.")
            if not self.exists(p) or not self.exists(c):
                raise ValueError("Componentes devem estar cadastrados.")
            if q <= 0:
                raise ValueError("Informe quantidade v\u00e1lida.")
            if p == c:
                raise ValueError("N\u00e3o \u00e9 permitido adicionar o mesmo item como Componente pai e Componente filho.")
            if self.would_create_cycle(p, c):
                raise ValueError("Esta rela\u00e7\u00e3o criaria um ciclo na estrutura.")
            
            with connect() as con:
                if con.execute("SELECT 1 FROM bom WHERE parent_code=? AND child_code=?", (p, c)).fetchone():
                    raise ValueError("Esse item filho j\u00e1 est\u00e1 vinculado a este mesmo item pai.")
                order = con.execute("SELECT COALESCE(MAX(sort_order), 0)+1 FROM bom WHERE parent_code=?", (p,)).fetchone()[0]
                con.execute("INSERT INTO bom(parent_code, child_code, quantity, required, assembly_location, sort_order, created_at) VALUES(?,?,?,?,?,?,?)", (p, c, q, self.b_required.get(), self.b_location.get(), order, datetime.now().isoformat(timespec="seconds")))
            
            self.clear_bom()
            self.refresh_all()
            messagebox.showinfo("MAPZER", "Item adicionado \u00e0 estrutura com sucesso.")
        except Exception as e:
            log_error(traceback.format_exc())
            messagebox.showerror("MAPZER", str(e))

    def bom_double_click(self, event=None):
        sel = self.bom_tree.selection()
        if not sel:
            return
        vals = self.bom_tree.item(sel[0], "values")
        parent = self.bom_tree.parent(sel[0])
        if not vals or not parent:
            return
        pvals = self.bom_tree.item(parent, "values")
        if vals[0] in self.root_codes():
            return messagebox.showinfo("MAPZER", "Itens principais (N\u00edvel 0) n\u00e3o podem ser removidos.")
        self.b_parent.set(display_item(pvals[0], pvals[1]))
        self.b_child.set(display_item(vals[0], vals[1]))
        set_value(self.b_qty, str(vals[3]))
        self.b_required.set(str(vals[4]))
        set_value(self.b_location, str(vals[5]))

    def remove_bom(self):
        p = code_from_display(self.b_parent.get()) if self.b_parent.get() else ""
        c = code_from_display(self.b_child.get()) if self.b_child.get() else ""
        
        if c in self.root_codes():
            return messagebox.showerror("MAPZER", "Itens principais (N\u00edvel 0) n\u00e3o podem ser removidos.")
        
        with connect() as con:
            found = con.execute("SELECT 1 FROM bom WHERE parent_code=? AND child_code=?", (p, c)).fetchone()
        
        if not found:
            return messagebox.showwarning("MAPZER", "D\u00ea dois cliques em um item filho da \u00e1rvore antes de remover.")
        
        if messagebox.askyesno("Confirmar remo\u00e7\u00e3o", f"Remover o item {c} do item pai {p}?\n\nO cadastro do item ser\u00e1 preservado."):
            with connect() as con:
                con.execute("DELETE FROM bom WHERE parent_code=? AND child_code=?", (p, c))
            self.clear_bom()
            self.refresh_all()
            messagebox.showinfo("MAPZER", "Item removido da estrutura com sucesso.")

    def move_bom(self, direction):
        sel = self.bom_tree.selection()
        if not sel:
            return messagebox.showwarning("MAPZER", "Selecione um item filho na \u00e1rvore.")
        node = sel[0]
        parent = self.bom_tree.parent(node)
        vals = self.bom_tree.item(node, "values")
        if not parent or not vals or vals[0] in self.root_codes():
            return messagebox.showwarning("MAPZER", "Selecione apenas um item filho para reorganizar.")
        pcode = self.bom_tree.item(parent, "values")[0]
        ccode = vals[0]
        with connect() as con:
            rows = con.execute("SELECT id, child_code, sort_order FROM bom WHERE parent_code=? ORDER BY sort_order, id", (pcode,)).fetchall()
            idx = next((i for i, r in enumerate(rows) if r[1] == ccode), None)
            target = idx + direction if idx is not None else -1
            if target < 0 or target >= len(rows):
                return
            a, b = rows[idx], rows[target]
            con.execute("UPDATE bom SET sort_order=? WHERE id=?", (b[2], a[0]))
            con.execute("UPDATE bom SET sort_order=? WHERE id=?", (a[2], b[0]))
        self.refresh_all()

    def build_movement_tab(self):
        page = self.tab_body("3. ESTOQUE", "Movimenta\u00e7\u00e3o de estoque", "A aba tem rolagem vertical quando a janela for pequena.")
        form = tk.Frame(page, bg=BG_APP)
        form.pack(fill="x")
        form.columnconfigure(1, weight=1)
        self.m_type = self.field(form, 0, "Tipo *", MOVEMENTS, editable=True)
        self.m_code = self.search_field(form, 1, "Item *")
        self.m_qty = self.field(form, 2, "Quantidade *", default="1")
        roots = sorted(self.root_codes())
        self.m_ref = self.field(form, 3, "Refer\u00eancia", default=(roots[0] if roots else ""))
        self.m_person = self.field(form, 4, "Respons\u00e1vel")
        self.m_notes = self.field(form, 5, "Observa\u00e7\u00e3o")
        RButton(page, text="LAN\u00c7AR MOVIMENTA\u00c7\u00c3O", command=self.save_movement, bg="#d97706", fg="white", relief="flat", padx=18, pady=8).pack(anchor="e", padx=18, pady=8)
        filt = tk.Frame(page, bg=BG_PANEL, padx=10, pady=8)
        filt.pack(fill="x", padx=18, pady=5)
        tk.Label(filt, text="Filtrar hist\u00f3rico por tipo:", bg=BG_PANEL, font=("Segoe UI", 10, "bold")).pack(side="left")
        self.m_filter = ttk.Combobox(filt, values=FILTERS, state="readonly", width=25, font=("Segoe UI", 9), height=8)
        block_mousewheel(self.m_filter)
        self.m_filter.set("Todos")
        self.m_filter.pack(side="left", padx=10)
        self.m_filter.bind("<<ComboboxSelected>>", lambda e: self.refresh_movements())
        RButton(filt, text="LIMPAR FILTRO", command=lambda: (self.m_filter.set("Todos"), self.refresh_movements()), bg="#64748b", fg="white", relief="flat", padx=12, pady=4).pack(side="left")
        self.m_filter_label = tk.Label(filt, text="", bg=BG_PANEL, fg="#0ea5e9")
        self.m_filter_label.pack(side="right")
        self.mov_tree = self.make_tree(page, ("Data", "Tipo", "C\u00f3digo", "Descri\u00e7\u00e3o", "Qtd.", "Refer\u00eancia"), (155, 155, 180, 320, 80, 160))

    def save_movement(self):
        try:
            typ = self.m_type.get()
            code = code_from_display(self.m_code.get())
            q = safe_float(self.m_qty.get(), "Quantidade")
            if not typ or not self.exists(code) or q <= 0:
                raise ValueError("Preencha Tipo, Item e Quantidade.")
            with connect() as con:
                con.execute("INSERT INTO movements(created_at, movement_type, item_code, quantity, reference, responsible, notes) VALUES(?,?,?,?,?,?,?)", (datetime.now().isoformat(timespec="seconds"), typ, code, q, self.m_ref.get(), self.m_person.get(), self.m_notes.get()))
            self.refresh_all()
            messagebox.showinfo("MAPZER", "Movimenta\u00e7\u00e3o registrada com sucesso.")
        except Exception as e:
            log_error(traceback.format_exc())
            messagebox.showerror("MAPZER", str(e))

    def build_summary_tab(self):
        page = self.tab_body("4. RESUMO", "Estoque e resumo", "Use a rolagem da p\u00e1gina e as barras das tabelas para consultar todos os dados em telas pequenas.")
        filt = tk.Frame(page, bg=BG_PANEL, padx=10, pady=8)
        filt.pack(fill="x", padx=18, pady=5)
        tk.Label(filt, text="Filtrar por status/situa\u00e7\u00e3o:", bg=BG_PANEL, font=("Segoe UI", 10, "bold")).pack(side="left")
        self.s_status = ttk.Combobox(filt, values=SUMMARY_FILTERS, state="readonly", width=24, font=("Segoe UI", 9), height=8)
        block_mousewheel(self.s_status)
        self.s_status.set("Todos")
        self.s_status.pack(side="left", padx=10)
        self.s_status.bind("<<ComboboxSelected>>", lambda e: self.filter_summary())
        tk.Label(filt, text="Busca:", bg=BG_PANEL, font=("Segoe UI", 10, "bold")).pack(side="left", padx=(12, 5))
        self.s_search = tk.Entry(filt, width=24)
        block_mousewheel(self.s_search)
        self.s_search.pack(side="left")
        self.s_search.bind("<KeyRelease>", lambda e: self.filter_summary())
        RButton(filt, text="LIMPAR FILTRO", command=lambda: (self.s_status.set("Todos"), self.s_search.delete(0, "end"), self.filter_summary()), bg="#64748b", fg="white", relief="flat", padx=12, pady=4).pack(side="left", padx=8)
        self.summary_count = tk.Label(filt, text="", bg=BG_PANEL, fg="#0ea5e9")
        self.summary_count.pack(side="right")
        self.summary_label = tk.Label(page, text="", bg=BG_APP, fg="#0ea5e9", font=("Segoe UI", 12, "bold"))
        self.summary_label.pack(anchor="w", padx=18, pady=5)
        self.stock_tree = self.make_tree(page, ("C\u00f3digo", "Descri\u00e7\u00e3o", "F\u00edsico", "Reservado", "Dispon\u00edvel", "Aquisi\u00e7\u00e3o", "Prazo", "Custo Unit.", "Custo Total", "Status", "Localiza\u00e7\u00e3o"), (145, 230, 70, 80, 80, 130, 75, 90, 90, 120, 160))
        self.stock_tree.tag_configure("ok", foreground="#16a34a")
        self.stock_tree.tag_configure("missing", foreground="#dc2626")
        self.stock_tree.tag_configure("reserved", foreground="#d97706")
        self.stock_tree.bind("<Double-1>", lambda e: self.show_details())
        bar = tk.Frame(page, bg=BG_APP)
        bar.pack(fill="x", padx=18, pady=8)
        RButton(bar, text="DETALHES DO ITEM", command=self.show_details, bg="#16a34a", fg="white", relief="flat", padx=14, pady=8).pack(side="left")
        RButton(bar, text="EXPORTAR CSV", command=self.export_csv, bg="#64748b", fg="white", relief="flat", padx=14, pady=8).pack(side="left", padx=8)
        RButton(bar, text="CRIAR BACKUP", command=self.backup, bg="#0ea5e9", fg="white", relief="flat", padx=14, pady=8).pack(side="left")
        RButton(bar, text="ABRIR PASTA", command=self.open_folder, bg="#64748b", fg="white", relief="flat", padx=14, pady=8).pack(side="left", padx=8)
        RButton(bar, text="ATUALIZAR", command=self.refresh_all, bg="#0ea5e9", fg="white", relief="flat", padx=14, pady=8).pack(side="right")

    def make_tree(self, page, cols, widths, tree_mode=False):
        frame = tk.Frame(page, bg=BG_APP)
        frame.pack(fill="both", expand=True, padx=18, pady=6)
        tree = ttk.Treeview(frame, columns=cols, show="tree headings" if tree_mode else "headings", height=12)
        if tree_mode:
            tree.heading("#0", text="\u00c1rvore")
            tree.column("#0", width=30, stretch=False)
        for c, w in zip(cols, widths):
            tree.heading(c, text=c)
            tree.column(c, width=w, anchor="w")
        vs = ttk.Scrollbar(frame, orient="vertical", command=tree.yview)
        hs = ttk.Scrollbar(frame, orient="horizontal", command=tree.xview)
        tree.configure(yscrollcommand=vs.set, xscrollcommand=hs.set)
        tree.grid(row=0, column=0, sticky="nsew")
        vs.grid(row=0, column=1, sticky="ns")
        hs.grid(row=1, column=0, sticky="ew")
        frame.columnconfigure(0, weight=1)
        frame.rowconfigure(0, weight=1)
        return tree

    def stock_values(self, con, code):
        # IMPORTANTE: comparar sempre contra a lista oficial MOVEMENTS (com
        # acentuacao correta) para nao repetir o bug de estoque da V33, onde
        # "Entrada fabricacao", "Saida producao" e "Liberacao reserva" (sem
        # acento) nunca combinavam com os valores reais gravados no banco.
        physical = reserved = 0
        for typ, q in con.execute("SELECT movement_type, quantity FROM movements WHERE item_code=?", (code,)):
            if typ in ("Entrada compra", "Entrada fabrica\u00e7\u00e3o", "Ajuste positivo"):
                physical += q
            elif typ in ("Sa\u00edda produ\u00e7\u00e3o", "Ajuste negativo"):
                physical -= q
            elif typ == "Reserva":
                reserved += q
            elif typ == "Libera\u00e7\u00e3o reserva":
                reserved -= q
        return physical, reserved

    def refresh_movements(self):
        for x in self.mov_tree.get_children():
            self.mov_tree.delete(x)
        selected = self.m_filter.get()
        sql = "SELECT m.created_at, m.movement_type, m.item_code, i.description, m.quantity, m.reference FROM movements m JOIN items i ON i.code=m.item_code"
        args = ()
        if selected != "Todos":
            sql += " WHERE m.movement_type=?"
            args = (selected,)
        with connect() as con:
            rows = con.execute(sql + " ORDER BY m.id DESC", args).fetchall()
        for r in rows:
            self.mov_tree.insert("", "end", values=r)
        self.m_filter_label.config(text=f"{len(rows)} movimento(s)")

    def populate_bom(self):
        for x in self.bom_tree.get_children():
            self.bom_tree.delete(x)
        with connect() as con:
            data = {c: (d, lvl) for c, d, lvl in con.execute("SELECT code, description, level FROM items")}
            edges = con.execute("SELECT parent_code, child_code, quantity, required, assembly_location FROM bom ORDER BY parent_code, sort_order, id").fetchall()
        children = {}
        for p, c, q, r, l in edges:
            children.setdefault(p, []).append((c, q, r, l))
        
        if not data:
            return
        
        def add(parent, code, level, q="", req="", loc="", path=None):
            path = set() if path is None else set(path)
            tag = "root" if level == 0 else "parent" if code in children else ""
            item_data = data.get(code, ("", 0))
            node = self.bom_tree.insert(parent, "end", values=(code, item_data[0], f"N\u00edvel {item_data[1]}", q, req, loc), open=True, tags=(tag,) if tag else ())
            if code in path:
                return
            path.add(code)
            for c, qq, rr, ll in children.get(code, []):
                add(node, c, level + 1, qq, rr, ll, path)
        
        # Adiciona itens de nivel 0
        for code, (desc, lvl) in sorted(data.items()):
            if lvl == 0 and code not in {c for p, c, _, _, _ in edges}:
                add("", code, 0)

    def filter_summary(self):
        for x in self.stock_tree.get_children():
            self.stock_tree.delete(x)
        query = self.s_search.get().upper()
        filt = self.s_status.get()
        listed = missing = total = 0
        with connect() as con:
            for code, desc, acq, lead, leadunit, cost, loc, lvl in con.execute("SELECT code, description, acquisition, lead_value, lead_unit, unit_cost, location, level FROM items ORDER BY code"):
                total += 1
                physical, reserved = self.stock_values(con, code)
                available = physical - reserved
                # Item de Nivel 0 (equipamento final) e considerado "OK" por
                # padrao, pois normalmente nao e comprado/fabricado em estoque.
                status = "OK" if lvl == 0 or available > 0 else "EM FALTA"
                if reserved > 0:
                    status += " (Com Reserva)"
                if "FALTA" in status:
                    missing += 1
                if filt == "Apenas OK" and available <= 0:
                    continue
                if filt == "Em Falta" and available > 0:
                    continue
                if filt == "Com Reserva" and reserved <= 0:
                    continue
                if filt == "Com Prazo / Aguardando" and not ((lead or 0) > 0 or acq == "Sob encomenda"):
                    continue
                if query and query not in code.upper() and query not in desc.upper() and query not in (acq or "").upper():
                    continue
                tag = "missing" if available <= 0 and lvl != 0 else "reserved" if reserved > 0 else "ok"
                self.stock_tree.insert("", "end", values=(code, desc, f"{physical:g}", f"{reserved:g}", f"{available:g}", acq or "-", f"{lead:g} {leadunit}" if lead else "-", f"R$ {cost:,.2f}", f"R$ {physical*cost:,.2f}", status, loc or ""), tags=(tag,))
                listed += 1
        self.summary_label.config(text=f"Itens: {total} | Em falta: {missing}")
        self.summary_count.config(text=f"{listed} item(ns) listado(s)")

    def show_details(self):
        sel = self.stock_tree.selection()
        if not sel:
            return messagebox.showwarning("MAPZER", "Selecione um item na tabela.")
        code = self.stock_tree.item(sel[0], "values")[0]
        with connect() as con:
            item = con.execute("SELECT description, classification, unit, acquisition, manufacturing_origin, purchase_link, lead_value, lead_unit, unit_cost, location, notes FROM items WHERE code=?", (code,)).fetchone()
            suppliers = con.execute("SELECT supplier_name, contact_name, phone, email, website, supplier_sku, item_link, price, lead_value, lead_unit, minimum_qty, minimum_unit, terms, shipping, status, notes FROM suppliers WHERE item_code=? ORDER BY sort_order, id", (code,)).fetchall()
            images = [r[0] for r in con.execute("SELECT image_path FROM item_images WHERE item_code=? ORDER BY sort_order, id", (code,))]
        win = tk.Toplevel(self)
        win.title(f"Detalhes do item - {code}")
        win.geometry("1120x740")
        win.minsize(760, 500)
        win.configure(bg=BG_APP)
        h = tk.Frame(win, bg="#0f172a", padx=16, pady=12)
        h.pack(fill="x")
        tk.Label(h, text=f"{code} \u2013 {item[0]}", bg="#0f172a", fg="white", font=("Segoe UI", 14, "bold")).pack(anchor="w")
        body = tk.Frame(win, bg=BG_APP, padx=18, pady=14)
        body.pack(fill="both", expand=True)
        body.columnconfigure(0, weight=3)
        body.columnconfigure(1, weight=2)
        left = tk.Frame(body, bg=BG_APP)
        left.grid(row=0, column=0, sticky="nsew", padx=(0, 10))
        basic = f"Classifica\u00e7\u00e3o: {item[1]}\nUnidade: {item[2]}\nAquisi\u00e7\u00e3o: {item[3] or '-'}\nOrigem: {item[4] or '-'}\nPrazo geral: {item[6]} {item[7]}\nCusto geral: R$ {item[8]:.2f}\nLocaliza\u00e7\u00e3o: {item[9] or '-'}"
        tk.Label(left, text=basic, bg=BG_PANEL, fg=TEXT, justify="left", anchor="nw", wraplength=500, padx=12, pady=12, relief="solid", bd=1).pack(fill="x")
        if item[5]:
            RButton(left, text="ABRIR LINK GERAL", command=lambda: open_url(item[5]), bg="#0ea5e9", fg="white", relief="flat", padx=12, pady=6).pack(anchor="w", pady=(8, 0))
        sn = ttk.Notebook(left)
        sn.pack(fill="both", expand=True, pady=(10, 0))
        if suppliers:
            for i, s in enumerate(suppliers):
                sf = tk.Frame(sn, bg=BG_PANEL, padx=10, pady=10)
                sn.add(sf, text="Principal" if i == 0 else f"Alternativo {i}")
                info = f"Fornecedor: {s[0]}\nContato: {s[1] or '-'}\nTelefone: {s[2] or '-'}\nE-mail: {s[3] or '-'}\nSKU: {s[5] or '-'}\nPre\u00e7o: R$ {s[7]:.2f}\nPrazo: {s[8]} {s[9]}\nQuantidade m\u00ednima: {s[10]} {s[11] or ''}\nPagamento: {s[12] or '-'}\nFrete/retirada: {s[13] or '-'}\nStatus: {s[14] or '-'}\n\nObserva\u00e7\u00f5es:\n{s[15] or '-'}"
                tk.Label(sf, text=info, bg=BG_PANEL, fg=TEXT, justify="left", anchor="nw", wraplength=460).pack(anchor="w")
                buttons = tk.Frame(sf, bg=BG_PANEL)
                buttons.pack(anchor="w", pady=8)
                if s[2]:
                    RButton(buttons, text="WHATSAPP", command=lambda phone=s[2]: webbrowser.open(whatsapp_url(phone)), bg="#16a34a", fg="white", relief="flat", padx=8, pady=4).pack(side="left")
                if s[4]:
                    RButton(buttons, text="ABRIR SITE", command=lambda url=s[4]: open_url(url), bg="#0ea5e9", fg="white", relief="flat", padx=8, pady=4).pack(side="left", padx=5)
                if s[6]:
                    RButton(buttons, text="ABRIR LINK DO ITEM", command=lambda url=s[6]: open_url(url), bg="#0ea5e9", fg="white", relief="flat", padx=8, pady=4).pack(side="left")
        else:
            sf = tk.Frame(sn, bg=BG_PANEL)
            sn.add(sf, text="Fornecedores")
            tk.Label(sf, text="Nenhum fornecedor detalhado cadastrado.", bg=BG_PANEL, fg=MUTED_TEXT).pack(padx=15, pady=15)
        dn = ttk.Notebook(left)
        dn.pack(fill="both", expand=True, pady=(10, 0))
        for title, content in self.detail_sections(item[10] or ""):
            f = tk.Frame(dn, bg=BG_PANEL)
            txt = tk.Text(f, wrap="word", height=6, bg=BG_PANEL, fg=TEXT, relief="flat", padx=10, pady=10)
            txt.insert("1.0", content or "Nenhuma informa\u00e7\u00e3o cadastrada.")
            txt.config(state="disabled")
            txt.pack(fill="both", expand=True)
            dn.add(f, text=title)
        gallery = tk.LabelFrame(body, text=f" FOTOS DO ITEM ({len(images)}/3) ", bg=BG_APP, fg="#0ea5e9", padx=10, pady=10)
        gallery.grid(row=0, column=1, sticky="nsew")
        if images:
            tabs = ttk.Notebook(gallery)
            tabs.pack(fill="both", expand=True)
            for i, p in enumerate(images, 1):
                tab = tk.Frame(tabs, bg=BG_PANEL)
                tabs.add(tab, text=f"Foto {i}")
                path = Path(p)
                if path.exists() and HAS_PIL:
                    try:
                        img = Image.open(path)
                        img.thumbnail((400, 480))
                        photo = ImageTk.PhotoImage(img)
                        lab = tk.Label(tab, image=photo, bg=BG_PANEL)
                        lab.image = photo
                        lab.pack(fill="both", expand=True, padx=8, pady=8)
                    except Exception:
                        tk.Label(tab, text="Foto n\u00e3o pode ser exibida", bg=BG_PANEL, fg=MUTED_TEXT).pack(pady=50)
                else:
                    tk.Label(tab, text="Foto n\u00e3o encontrada", bg=BG_PANEL, fg=MUTED_TEXT).pack(pady=50)
        else:
            tk.Label(gallery, text="Sem fotos anexadas", bg=BG_APP, fg=MUTED_TEXT).pack(pady=80)
        RButton(win, text="FECHAR", command=win.destroy, bg="#64748b", fg="white", relief="flat", padx=18, pady=7).pack(pady=10)

    def detail_sections(self, text):
        def ext(a, b):
            m = re.search(re.escape(a) + r"\n?(.*?)\n?" + re.escape(b), text, re.S)
            return m.group(1).strip() if m else ""
        obs = ext("[OBSERVACOES]", "[/OBSERVACOES]")
        p3d = ext("[PARAMETROS_3D]", "[/PARAMETROS_3D]")
        tech = ext("[FICHA_TECNICA]", "[/FICHA_TECNICA]")
        if not obs and not p3d and not tech:
            obs = text
        return [("OBSERVA\u00c7\u00d5ES", obs), ("PAR\u00c2METROS DE IMPRESS\u00c3O 3D", p3d), ("FICHA T\u00c9CNICA", tech)]

    def export_csv(self):
        path = filedialog.asksaveasfilename(defaultextension=".csv", filetypes=[("CSV", "*.csv")])
        if not path:
            return
        with open(path, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f, delimiter=";")
            w.writerow(self.stock_tree["columns"])
            for row in self.stock_tree.get_children():
                w.writerow(self.stock_tree.item(row, "values"))
        messagebox.showinfo("MAPZER", "Arquivo exportado.")

    def backup(self):
        dest = PROGRAM_DIR / f"Backup_MAPZER_{datetime.now().strftime('%Y-%m-%d_%H%M%S')}.db"
        shutil.copy2(DB_PATH, dest)
        messagebox.showinfo("MAPZER", f"Backup criado:\n{dest.name}")

    def open_folder(self):
        if sys.platform.startswith("win"):
            os.startfile(PROGRAM_DIR)
        elif sys.platform == "darwin":
            os.system(f"open '{PROGRAM_DIR}'")
        else:
            os.system(f"xdg-open '{PROGRAM_DIR}'")

    def refresh_all(self):
        self.populate_bom()
        self.refresh_movements()
        self.filter_summary()

def main():
    try:
        init_db()
        App().mainloop()
    except Exception:
        log_error(traceback.format_exc())
        root = tk.Tk()
        root.withdraw()
        messagebox.showerror("MAPZER", f"Erro ao iniciar. Consulte:\n{LOG_PATH}")
        root.destroy()

if __name__ == "__main__":
    main()