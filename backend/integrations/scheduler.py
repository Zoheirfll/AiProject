from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from django_apscheduler.jobstores import DjangoJobStore

scheduler = BackgroundScheduler()
scheduler.add_jobstore(DjangoJobStore(), "default")


def start():
    if not scheduler.running:
        from automatisations.services import evaluer_regles, generer_rapport_quotidien

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
        scheduler.start()
