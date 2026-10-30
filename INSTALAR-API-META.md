# Ligar a API oficial da Meta (Business Discovery)

Serve para o celular, o navegador e o computador, cada um sozinho, sem servidor. Só lista perfis **Criador ou Empresa** (sem views nem stories).

1. A conta do Instagram que vai consultar precisa ser **Criador ou Empresa** e estar ligada a uma **Página do Facebook**.
2. Em developers.facebook.com crie um app (tipo Empresa) e, no **Graph API Explorer**, escolha esse app e gere um token de usuário com as permissões `instagram_basic`, `pages_show_list` e `pages_read_engagement`.
3. Para o ID: no Explorer, `me/accounts?fields=instagram_business_account` e copie o `id` de dentro de `instagram_business_account`.
4. No Mirante: **Ajustes → API oficial da Meta**, cole o ID e o token, toque em **Testar e salvar**.
5. O token do Explorer dura cerca de 1 hora. Para durar ~60 dias, troque por um de longa duração (`oauth/access_token?grant_type=fb_exchange_token&client_id=...&client_secret=...&fb_exchange_token=...`) **no navegador, fora do app**: o segredo do app nunca entra no Mirante.
6. Quando o token vencer o app avisa ("A Meta recusou o token"); gere outro e salve de novo.

Perfis pessoais ou privados aparecem com o aviso "só enxerga Criador ou Empresa". No navegador as miniaturas podem não carregar (a Meta não libera as imagens para páginas web); no Android carregam.
