# buddy

Un petit renard animé au-dessus du prompt de Claude Code, qui mime ce que fait Claude : il tape au clavier quand Claude écrit un fichier, lit un livre quand il lit, court quand il lance une commande, cherche à la loupe quand il fait une recherche, dort quand rien ne se passe et saute de joie avec des étoiles quand c'est fini.

Quand Claude lance des sous-agents, un panneau latéral « Le bureau » montre un bureau en pixel art vu de dessus : chaque agent est une petite créature avec un nom, qui entre par la porte, marche jusqu'à son bureau, travaille (bulle, étiquette d'état, écran coloré, jauge), puis traverse le pont pour aller se reposer au salon. Chaque créature a son son de fin, une finale joue quand toute l'équipe a fini, et un tableau des records compte les tâches finies d'une session à l'autre.

## Installer

Dans une session Claude Code, dans un terminal :

```
/plugin install buddy --marketplace nsanchrist27-cmyk/buddy-office
```

Répondez `y` pour ajouter la marketplace, puis choisissez la portée (utilisateur par défaut).

Depuis un shell :

```
claude plugin install buddy --marketplace nsanchrist27-cmyk/buddy-office
```

Dans l'application de bureau : cliquez sur + à côté du champ de saisie, puis Plugins, Add marketplace avec `nsanchrist27-cmyk/buddy-office`, puis Add plugin.

## Utiliser

- Le renard s'affiche tout seul au-dessus du prompt.
- `/bureau` ouvre le bureau en pixel art dans le panneau latéral (il s'ouvre aussi tout seul quand un agent arrive).
- Les sons se jouent avec `afplay` sur macOS ; ailleurs, le mod reste silencieux.
