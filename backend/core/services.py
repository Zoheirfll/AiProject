import openpyxl

from employees.models import Employee

REQUIRED_COLUMNS = ["matricule", "nom", "prenom"]
COLUMN_MAP = {
    "matricule": "matricule",
    "nom": "nom",
    "prenom": "prenom",
    "email": "email",
    "departement": "departement",
    "département": "departement",
    "poste": "poste",
    "date_embauche": "date_embauche",
    "date d'embauche": "date_embauche",
}


def parse_employee_excel(file_obj):
    """Parse an uploaded Excel file into Employee rows.

    Returns (total, imported, errors) where errors is a list of
    {"ligne": int, "message": str} dicts.
    """
    workbook = openpyxl.load_workbook(file_obj, data_only=True)
    sheet = workbook.active

    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        return 0, 0, [{"ligne": 0, "message": "Fichier vide"}]

    header = [str(cell).strip().lower() if cell else "" for cell in rows[0]]
    field_by_col = {i: COLUMN_MAP[h] for i, h in enumerate(header) if h in COLUMN_MAP}

    missing = [c for c in REQUIRED_COLUMNS if c not in field_by_col.values()]
    if missing:
        return 0, 0, [
            {"ligne": 1, "message": f"Colonnes manquantes: {', '.join(missing)}"}
        ]

    total = 0
    imported = 0
    errors = []

    for line_num, row in enumerate(rows[1:], start=2):
        if all(cell is None for cell in row):
            continue
        total += 1
        data = {field_by_col[i]: row[i] for i in field_by_col if i < len(row)}

        if not data.get("matricule") or not data.get("nom") or not data.get("prenom"):
            errors.append({"ligne": line_num, "message": "Champs requis manquants"})
            continue

        try:
            Employee.objects.update_or_create(
                matricule=str(data["matricule"]).strip(),
                defaults={
                    "nom": str(data.get("nom", "")).strip(),
                    "prenom": str(data.get("prenom", "")).strip(),
                    "email": str(data.get("email") or "").strip(),
                    "departement": str(data.get("departement") or "").strip(),
                    "poste": str(data.get("poste") or "").strip(),
                    "date_embauche": data.get("date_embauche") or None,
                },
            )
            imported += 1
        except Exception as exc:  # noqa: BLE001
            errors.append({"ligne": line_num, "message": str(exc)})

    return total, imported, errors
