# 📁 Modelos 3D — Pasta de arquivos GLB

Coloque aqui os arquivos `.glb` de cada filme da coleção.

## Padrão de nomes

Use o mesmo **slug** que você define no admin panel para o filme.
O slug é gerado automaticamente a partir do título (letras minúsculas, sem acentos, espaços viram hífens).

**Exemplos:**
- Stalker → `stalker.glb`
- O Poderoso Chefão → `o-poderoso-chefao.glb`
- 2001 Uma Odisseia no Espaço → `2001-uma-odisseia-no-espaco.glb`

## Como gerar o slug de um título

No Admin Panel, ao adicionar o filme, o campo **"Arquivo 3D (GLB)"**
já sugere automaticamente o slug baseado no título.
Basta nomear o seu arquivo GLB da mesma forma.

## Formatos aceitos

- `.glb` — formato preferido (binário, texturas embutidas, único arquivo)
- `.gltf` — também aceito, mas requer que as texturas estejam na mesma pasta

## Dica: Como exportar para GLB

Se usar **Blender** para escanear/modelar:
1. File → Export → glTF 2.0 (.glb/.gltf)
2. Selecione formato **GLB** (binário)
3. Marque "Include > Selected Objects" se quiser apenas o modelo
4. Recomendado: ative "Draco Mesh Compression" para arquivos menores

Se usar **iPhone/iPad** com aplicativos de scan (Polycam, Scaniverse, etc.):
- Exporte diretamente como GLB / USDZ → converta USDZ para GLB com
  alguma ferramenta online se necessário.
