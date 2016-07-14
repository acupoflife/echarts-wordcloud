var echarts = require('echarts');
var layoutUtil = require('echarts/lib/util/layout');

require('./WordCloudSeries');
require('./WordCloudView');

var wordCloudLayoutHelper = require('./layout');

if (!wordCloudLayoutHelper.isSupported) {
    throw new Error('Sorry your browser not support wordCloud');
}

// https://github.com/timdream/wordcloud2.js/blob/c236bee60436e048949f9becc4f0f67bd832dc5c/index.js#L233
function updateCanvasMask(maskCanvas) {
    var ctx = maskCanvas.getContext('2d');
    var imageData = ctx.getImageData(
        0, 0, maskCanvas.width, maskCanvas.height);
    var newImageData = ctx.createImageData(imageData);

    for (var i = 0; i < imageData.data.length; i += 4) {
        var tone = imageData.data[i] +
            imageData.data[i + 1] +
            imageData.data[i + 2];
        var alpha = imageData.data[i + 3];

        if (alpha < 128 || tone > 128 * 3) {
            // Area not to draw
            newImageData.data[i] = 0;
            newImageData.data[i + 1] = 0;
            newImageData.data[i + 2] = 0;
            newImageData.data[i + 3] = 0;
        }
        else {
            // Area to draw
            // The color must be same with backgroundColor
            newImageData.data[i] = 255;
            newImageData.data[i + 1] = 255;
            newImageData.data[i + 2] = 255;
            newImageData.data[i + 3] = 255;
        }
    }

    ctx.putImageData(newImageData, 0, 0);
}

echarts.registerLayout(function (ecModel, api) {
    ecModel.eachSeries(function (seriesModel) {
        var gridRect = layoutUtil.getLayoutRect(
            seriesModel.getBoxLayoutParams(), {
                width: api.getWidth(),
                height: api.getHeight()
            }
        );
        var data = seriesModel.getData();

        var canvas = document.createElement('canvas');
        canvas.width = gridRect.width;
        canvas.height = gridRect.height;

        var ctx = canvas.getContext('2d');
        var maskImage = seriesModel.get('maskImage');
        if (maskImage) {
            try {
                ctx.drawImage(maskImage, 0, 0, canvas.width, canvas.height);
                updateCanvasMask(canvas);
            }
            catch (e) {
                console.error('Invalid mask image');
                console.error(e.toString());
            }
        }

        var sizeRange = seriesModel.get('sizeRange');
        var rotationRange = seriesModel.get('rotationRange');
        var valueExtent = data.getDataExtent('value');

        var DEGREE_TO_RAD = Math.PI / 180;
        var gridSize = seriesModel.get('gridSize');
        wordCloudLayoutHelper(canvas, {
            list: data.mapArray('value', function (value, idx) {
                var itemModel = data.getItemModel(idx);
                return [
                    data.getName(idx),
                    itemModel.get('textStyle.normal.textSize', true)
                        || echarts.number.linearMap(value, valueExtent, sizeRange),
                    idx
                ];
            }),
            fontFamily: seriesModel.get('textStyle.normal.fontFamily')
                || seriesModel.get('textStyle.emphasis.fontFamily')
                || ecModel.get('textStyle.fontFamily'),
            fontWeight: seriesModel.get('textStyle.normal.fontWeight')
                || seriesModel.get('textStyle.emphasis.fontWeight')
                || ecModel.get('textStyle.fontWeight'),
            gridSize: gridSize,

            ellipticity: gridRect.height / gridRect.width,

            minRotation: rotationRange[0] * DEGREE_TO_RAD,
            maxRotation: rotationRange[1] * DEGREE_TO_RAD,

            clearCanvas: !maskImage
        });

        canvas.addEventListener('wordclouddrawn', function (e) {
            var item = e.detail.item;
            if (e.detail.drawn && seriesModel.layoutInstance.ondraw) {
                e.detail.drawn.gx += gridRect.x / gridSize;
                e.detail.drawn.gy += gridRect.y / gridSize;
                seriesModel.layoutInstance.ondraw(
                    item[0], item[1], item[2], e.detail.drawn
                );
            }
        });

        seriesModel.layoutInstance = {
            ondraw: null
        };
    });
});
