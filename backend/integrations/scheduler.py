from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from django_apscheduler.jobstores import DjangoJobStore

scheduler = BackgroundScheduler()
scheduler.add_jobstore(DjangoJobStore(), "default")


def start():
    if not scheduler.running:
        from automatisations.services import (
            evaluer_regles,
            evaluer_taches_surveillance,
            generer_rapport_quotidien,
        )
        from core.services import scan_dossier_surveille

        scheduler.add_job(
            evaluer_regles,
            trigger=CronTrigger(hour=9, minute=0),
            id="evaluer_regles_automatisations",
            replace_existing=True,
        )
        scheduler.add_job(
            generer_rapport_quotidien,
            trigger=CronTrigger(hour=9, minute=5),
            id="rapport_quotidien",
            replace_existing=True,
        )
        scheduler.add_job(
            evaluer_taches_surveillance,
            trigger=IntervalTrigger(minutes=5),
            id="evaluer_taches_surveillance",
            replace_existing=True,
        )
        scheduler.add_job(
            scan_dossier_surveille,
            trigger=IntervalTrigger(seconds=45),
            id="scan_dossier_surveille",
            replace_existing=True,
        )
        scheduler.start()
